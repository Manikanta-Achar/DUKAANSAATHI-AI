import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';

process.env.MONGOMS_DOWNLOAD_DIR = resolve('.cache/mongodb-binaries');
process.env.NODE_ENV = 'test';
process.env.GEMINI_API_KEY = '';
delete process.env.VERCEL;

test('customer assistant creates and credits atomically without crossing shop boundaries', { timeout: 180000 }, async (t) => {
  const replica = await MongoMemoryReplSet.create({ replSet: { count: 1 }, binary: { version: '7.0.24' } });
  process.env.MONGODB_URI = replica.getUri('customer_assistant_test');
  let server;
  try {
    const { connectDB } = await import('../config/db.js');
    const { default: app } = await import('../api/index.js');
    await connectDB();
    await Promise.all(Object.values(mongoose.models).map((model) => model.init()));
    server = app.listen(0, '127.0.0.1');
    await new Promise((resolve) => server.once('listening', resolve));
    const base = `http://127.0.0.1:${server.address().port}`;
    const shop = {}, other = {};
    const request = async (path, { method = 'POST', body = {}, jar = shop, key = randomUUID(), expected = 200 } = {}) => {
      const response = await fetch(base + path, { method, headers: {
        Origin: 'http://localhost:5173', 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest',
        'Idempotency-Key': key, ...(jar.cookie ? { Cookie: jar.cookie, 'X-CSRF-Token': jar.csrf } : {}),
      }, ...(method === 'GET' ? {} : { body: JSON.stringify(body) }) });
      const result = await response.json();
      assert.equal(response.status, expected, `${path}: ${JSON.stringify(result)}`);
      if (result.data?.csrfToken) {
        jar.cookie = response.headers.get('set-cookie').split(';')[0];
        jar.csrf = result.data.csrfToken;
        jar.id = result.data.user.id;
      }
      return result.data;
    };
    for (const [jar, email] of [[shop, 'voice@example.com'], [other, 'other-voice@example.com']]) {
      await request('/api/auth/register', { jar, expected: 201, body: { name: 'Voice Tester', shopName: 'Isolated Shop', email, password: 'VoicePassword42', confirmPassword: 'VoicePassword42' } });
    }
    const interpret = (transcript, jar = shop) => request('/api/voice/process', { jar, body: { transcript } });
    const preview = (input, jar = shop) => request('/api/voice/preview', { jar, body: input });
    const execute = (body, options = {}) => request('/api/voice/execute', { ...options, body: { ...body, confirmed: true } });
    const Customer = mongoose.models.Customer;
    const Transaction = mongoose.models.Transaction;
    let maheshId;

    await t.test('standalone text creates Mahesh at zero only after confirmation and survives fresh reads', async () => {
      const action = await interpret('Create a new customer named Mahesh.');
      assert.equal(action.action, 'CREATE_CUSTOMER');
      assert.equal(action.customerName, 'Mahesh');
      assert.equal(action.customerStatus, 'missing');
      assert.equal(await Customer.countDocuments(), 0);
      await request('/api/voice/execute', { body: { action: action.action, customerName: 'Mahesh', createCustomer: true }, expected: 400 });
      const result = await execute({ action: action.action, customerName: 'Mahesh', createCustomer: true, ownerId: other.id });
      maheshId = result.customer._id;
      assert.equal(result.customer.ownerId, shop.id);
      assert.equal(result.customer.isArchived, false);
      assert.equal(result.customer.totalUdhaar, 0);
      assert.equal(result.transaction, null);
      const list = await request('/api/customers?status=active', { method: 'GET' });
      assert(list.some((customer) => customer._id === maheshId));
    });

    await t.test('credit 100 by text, repay 40 by text, and verify 60 in ledger, dashboard, and history', async () => {
      const credit = await interpret('Mahesh ko 100 rupaye udhaar do');
      assert.equal(credit.action, 'ADD_UDHAAR');
      assert.equal(credit.customerContext.id, maheshId);
      await execute({ action: credit.action, customerName: credit.customerName, customerId: credit.customerContext.id, amount: credit.amount });
      const repayment = await interpret('Mahesh ne 40 rupaye wapas diye');
      const result = await execute({ action: repayment.action, customerName: repayment.customerName, amount: repayment.amount });
      assert.equal(result.customer.totalUdhaar, 60);
      const customer = await request(`/api/udhaar/customers/${maheshId}`, { method: 'GET' });
      assert.equal(customer.totalUdhaar, 60);
      assert.equal(customer.history.length, 2);
      assert.equal((await request('/api/dashboard', { method: 'GET' })).outstandingUdhaar, 60);
      assert.equal((await request('/api/transactions', { method: 'GET' })).length, 2);
    });

    await t.test('case and whitespace variants reuse the existing customer without duplicate creation', async () => {
      const action = await preview({ action: 'ADD_UDHAAR', customerName: '  mAhEsH  ', amount: 10 });
      assert.equal(action.customerContext.id, maheshId);
      const result = await execute({ action: 'ADD_UDHAAR', customerName: '   MAHESH  ', amount: 10, createCustomer: true });
      assert.equal(result.createdCustomer, false);
      assert.equal(result.customer.totalUdhaar, 70);
      assert.equal(await Customer.countDocuments({ ownerId: shop.id }), 1);
    });

    await t.test('missing Mahesh in another shop gets one combined create-and-credit preview and transaction', async () => {
      const action = await interpret('Mahesh ko 100 rupaye udhaar do', other);
      assert.equal(action.customerStatus, 'missing');
      assert.equal(action.confirmationMessage, 'Mahesh is a new customer. Create Mahesh and add ₹100 udhaar?');
      assert.equal(await Customer.countDocuments({ ownerId: other.id }), 0);
      const result = await execute({ action: action.action, customerName: action.customerName, amount: action.amount, createCustomer: true }, { jar: other });
      assert.equal(result.createdCustomer, true);
      assert.equal(result.customer.ownerId, other.id);
      assert.equal(result.customer.totalUdhaar, 100);
      assert.notEqual(result.customer._id, maheshId);
      assert.equal(result.transaction.customerId, result.customer._id);
      assert.equal(result.transaction.ownerId, other.id);
      assert.equal((await Customer.findById(maheshId)).totalUdhaar, 70);
    });

    await t.test('repeated and simultaneous requests replay one customer and one credit', async () => {
      const key = randomUUID();
      const body = { action: 'ADD_UDHAAR', customerName: 'Retry Customer', amount: 100, createCustomer: true };
      const [first, second] = await Promise.all([execute(body, { key }), execute(body, { key })]);
      const third = await execute(body, { key });
      assert.equal(first.customer._id, second.customer._id);
      assert.equal(first.transaction._id, third.transaction._id);
      assert.equal(await Customer.countDocuments({ ownerId: shop.id, normalizedName: 'retry customer' }), 1);
      assert.equal(await Transaction.countDocuments({ customerId: first.customer._id }), 1);
      assert.equal((await Customer.findById(first.customer._id)).totalUdhaar, 100);
      await execute({ ...body, amount: 101 }, { key, expected: 409 });
    });

    await t.test('standalone creation also replays rather than creating a duplicate', async () => {
      const key = randomUUID();
      const body = { action: 'CREATE_CUSTOMER', customerName: 'Standalone Retry', createCustomer: true };
      const first = await execute(body, { key });
      const second = await execute(body, { key });
      assert.equal(first.customer._id, second.customer._id);
      const existing = await execute(body);
      assert.equal(existing.createdCustomer, false);
      assert.equal(await Customer.countDocuments({ ownerId: shop.id, normalizedName: 'standalone retry' }), 1);
    });

    await t.test('different simultaneous request IDs cannot create duplicate normalized names', async () => {
      const responses = await Promise.all([1, 2].map(() => fetch(base + '/api/voice/execute', {
        method: 'POST', headers: { Origin: 'http://localhost:5173', 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest', Cookie: shop.cookie, 'X-CSRF-Token': shop.csrf, 'Idempotency-Key': randomUUID() },
        body: JSON.stringify({ action: 'ADD_UDHAAR', customerName: 'Concurrent Customer', amount: 100, createCustomer: true, confirmed: true }),
      })));
      assert(responses.every((response) => [200, 409].includes(response.status)));
      const successful = responses.filter((response) => response.status === 200).length;
      assert(successful >= 1);
      const customers = await Customer.find({ ownerId: shop.id, normalizedName: 'concurrent customer' });
      assert.equal(customers.length, 1);
      assert.equal(customers[0].totalUdhaar, 100 * successful);
      assert.equal(await Transaction.countDocuments({ customerId: customers[0]._id }), successful);
    });

    await t.test('history or idempotency-save failures roll back new customer, balance, and transaction', async () => {
      for (const [Model, name] of [[Transaction, 'History Rollback'], [mongoose.models.Operation, 'Idempotency Rollback']]) {
        const create = Model.create;
        Model.create = async () => { throw new Error('Simulated save failure'); };
        const count = await Transaction.countDocuments();
        try { await execute({ action: 'ADD_UDHAAR', customerName: name, amount: 100, createCustomer: true }, { expected: 500 }); }
        finally { Model.create = create; }
        assert.equal(await Customer.countDocuments({ name }), 0);
        assert.equal(await Transaction.countDocuments(), count);
      }
    });

    await t.test('legacy owned multiword names tolerate repeated and surrounding spaces', async () => {
      const legacy = await Customer.collection.insertOne({ ownerId: new mongoose.Types.ObjectId(shop.id), name: '  Mary    Jane  ', totalUdhaar: 0 });
      const action = await interpret('Mary Jane ko 20 rupaye udhaar do');
      assert.equal(action.customerContext.id, String(legacy.insertedId));
      assert.equal(action.customerName, 'Mary Jane');
      const result = await execute({ action: action.action, customerName: '  MARY   JANE ', amount: 20, createCustomer: true });
      assert.equal(result.customer._id, String(legacy.insertedId));
      assert.equal(result.createdCustomer, false);
    });

    await t.test('ambiguous legacy duplicates require explicit selection and never create a third record', async () => {
      const records = await Customer.collection.insertMany([
        { ownerId: new mongoose.Types.ObjectId(shop.id), name: 'Duplicate Customer', phone: '111', totalUdhaar: 0 },
        { ownerId: new mongoose.Types.ObjectId(shop.id), name: 'duplicate   customer', phone: '222', totalUdhaar: 0 },
      ]);
      const action = await preview({ action: 'ADD_UDHAAR', customerName: 'Duplicate Customer', amount: 100 });
      assert.equal(action.customerStatus, 'ambiguous');
      assert.equal(action.canConfirm, false);
      assert.equal(action.customerCandidates.length, 2);
      await execute({ action: 'ADD_UDHAAR', customerName: 'Duplicate Customer', amount: 100, createCustomer: true }, { expected: 409 });
      const id = String(records.insertedIds[1]);
      const selected = await preview({ action: 'ADD_UDHAAR', customerName: 'Duplicate Customer', amount: 100, customerId: id });
      assert.equal(selected.canConfirm, true);
      await execute({ action: selected.action, customerName: selected.customerName, amount: 100, customerId: id });
      assert.equal((await Customer.findById(id)).totalUdhaar, 100);
      assert.equal((await Customer.findById(records.insertedIds[0])).totalUdhaar, 0);
    });

    await t.test('partial similar names are presented for selection, never guessed or duplicated', async () => {
      for (const name of ['Alice Kumar', 'Alice Sharma']) await request('/api/udhaar/customers', { body: { name }, expected: 201 });
      const action = await preview({ action: 'ADD_UDHAAR', customerName: 'Alice', amount: 5 });
      assert.equal(action.customerStatus, 'ambiguous');
      assert.equal(action.customerCandidates.length, 2);
      await execute({ action: 'ADD_UDHAAR', customerName: 'Alice', amount: 5, createCustomer: true }, { expected: 409 });
      assert.equal(await Customer.countDocuments({ name: 'Alice' }), 0);
    });

    await t.test('archived customer must be explicitly restored, preserving ID, history, and balance', async () => {
      await request(`/api/udhaar/customers/${maheshId}/archive`);
      const action = await interpret('Mahesh ko 10 rupaye udhaar do');
      assert.equal(action.customerStatus, 'archived');
      assert.match(action.confirmationMessage, /Restore Mahesh/);
      await execute({ action: 'ADD_UDHAAR', customerName: 'Mahesh', amount: 10, createCustomer: true }, { expected: 409 });
      const result = await execute({ action: 'ADD_UDHAAR', customerName: 'Mahesh', amount: 10, restoreCustomer: true });
      assert.equal(result.customer._id, maheshId);
      assert.equal(result.restoredCustomer, true);
      assert.equal(result.customer.totalUdhaar, 80);
      assert.equal(result.customer.isArchived, false);
      assert.equal(await Customer.countDocuments({ ownerId: shop.id, normalizedName: 'mahesh' }), 1);
    });

    await t.test('standalone creation restores an archived account without a credit or balance reset', async () => {
      await request(`/api/udhaar/customers/${maheshId}/archive`);
      const action = await preview({ action: 'CREATE_CUSTOMER', customerName: 'Mahesh' });
      assert.equal(action.customerStatus, 'archived');
      assert.match(action.confirmationMessage, /Restore the existing customer/);
      const count = await Transaction.countDocuments();
      const restored = await execute({ action: 'CREATE_CUSTOMER', customerName: 'Mahesh', restoreCustomer: true });
      assert.equal(restored.customer._id, maheshId);
      assert.equal(restored.customer.totalUdhaar, 80);
      assert.equal(restored.transaction, null);
      assert.equal(await Transaction.countDocuments(), count);
    });

    await t.test('failed restore-and-credit rolls back the archive flag and balance', async () => {
      await request(`/api/udhaar/customers/${maheshId}/archive`);
      const create = Transaction.create;
      Transaction.create = async () => { throw new Error('History failure'); };
      try { await execute({ action: 'ADD_UDHAAR', customerName: 'Mahesh', amount: 10, restoreCustomer: true }, { expected: 500 }); }
      finally { Transaction.create = create; }
      const customer = await Customer.findById(maheshId);
      assert.equal(customer.isArchived, true);
      assert.equal(customer.totalUdhaar, 80);
    });

    await t.test('repayments never create or implicitly restore a customer and reject excess amounts', async () => {
      const missing = await interpret('Missing Person ne 40 rupaye wapas diye');
      assert.equal(missing.canConfirm, false);
      await execute({ action: 'RECORD_REPAYMENT', customerName: 'Missing Person', amount: 40, createCustomer: true }, { expected: 404 });
      assert.equal(await Customer.countDocuments({ name: 'Missing Person' }), 0);
      await execute({ action: 'RECORD_REPAYMENT', customerName: 'Mahesh', amount: 40, restoreCustomer: true }, { expected: 409 });
      await request(`/api/udhaar/customers/${maheshId}/unarchive`);
      assert.equal((await preview({ action: 'RECORD_REPAYMENT', customerName: 'Mahesh', amount: 81 })).canConfirm, false);
      await execute({ action: 'RECORD_REPAYMENT', customerName: 'Mahesh', amount: 81 }, { expected: 400 });
    });

    await t.test('stale create and archive previews require a new explicit confirmation plan', async () => {
      await execute({ action: 'ADD_UDHAAR', customerName: 'No Preview', amount: 10 }, { expected: 409 });
      await request(`/api/udhaar/customers/${maheshId}/archive`);
      await execute({ action: 'ADD_UDHAAR', customerName: 'Mahesh', customerId: maheshId, amount: 5 }, { expected: 409 });
      assert.equal((await Customer.findById(maheshId)).totalUdhaar, 80);
      await request(`/api/udhaar/customers/${maheshId}/unarchive`);
    });

    await t.test('foreign IDs cannot be selected, credited, repaid, restored, or used for customer creation', async () => {
      for (const action of ['ADD_UDHAAR', 'RECORD_REPAYMENT', 'CREATE_CUSTOMER']) {
        const body = { action, customerName: 'Mahesh', customerId: maheshId, amount: 5, createCustomer: true, restoreCustomer: true };
        await request('/api/voice/preview', { jar: other, body, expected: 404 });
        await execute(body, { jar: other, expected: 404 });
      }
      assert.equal((await Customer.findById(maheshId)).totalUdhaar, 80);
      assert.equal(await Customer.countDocuments({ ownerId: other.id }), 1);
    });

    await t.test('Hindi, Kannada, and English customer commands retain names, actions, and amounts', async () => {
      const samples = [
        ['Create a new customer named Mahesh Kumar.', 'CREATE_CUSTOMER', 'Mahesh Kumar', 0],
        ['महेश नाम का नया ग्राहक बनाओ', 'CREATE_CUSTOMER', 'महेश', 0],
        ['ಮಹೇಶ್ ಹೆಸರಿನ ಹೊಸ ಗ್ರಾಹಕ ಸೇರಿಸಿ', 'CREATE_CUSTOMER', 'ಮಹೇಶ್', 0],
        ['महेश को १०० रुपये उधार दो', 'ADD_UDHAAR', 'महेश', 100],
        ['ಮಹೇಶ್ ಗೆ ೧೦೦ ರೂಪಾಯಿ ಉದ್ರಿ ಕೊಡು', 'ADD_UDHAAR', 'ಮಹೇಶ್', 100],
        ['Give 100 rupees credit to Mahesh Kumar.', 'ADD_UDHAAR', 'Mahesh Kumar', 100],
        ['Mahesh Kumar paid 40 rupees.', 'RECORD_REPAYMENT', 'Mahesh Kumar', 40],
        ['ಮಹೇಶ್ 40 ರೂಪಾಯಿ ಕೊಟ್ಟಿದ್ದಾನೆ', 'RECORD_REPAYMENT', 'ಮಹೇಶ್', 40],
      ];
      for (const [transcript, action, customerName, amount] of samples) {
        const parsed = await interpret(transcript);
        assert.equal(parsed.action, action, transcript);
        assert.equal(parsed.customerName, customerName, transcript);
        assert.equal(parsed.amount, amount, transcript);
      }
    });
  } finally {
    if (server) await new Promise((resolve) => server.close(resolve));
    await mongoose.disconnect();
    await replica.stop();
  }
});
