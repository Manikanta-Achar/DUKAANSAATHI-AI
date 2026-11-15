import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';

process.env.MONGOMS_DOWNLOAD_DIR = resolve('.cache/mongodb-binaries');
process.env.NODE_ENV = 'test';
process.env.GEMINI_API_KEY = '';
process.env.CLIENT_URL = 'https://shop.example.com';
delete process.env.VERCEL;

test('authenticated shop workflows against an isolated MongoDB replica set', { timeout: 900000 }, async (t) => {
  const replica = await MongoMemoryReplSet.create({ replSet: { count: 1 }, binary: { version: '7.0.24' } });
  // Deliberately replace any production URI BEFORE importing the app or its models.
  process.env.MONGODB_URI = replica.getUri('dukaansaathi_test');
  let server;
  try {
    const { connectDB } = await import('../config/db.js');
    const { default: app } = await import('../api/index.js');
    await connectDB();
    await Promise.all(Object.values(mongoose.models).map((model) => model.init()));
    server = app.listen(0, '127.0.0.1');
    await new Promise((resolve) => server.once('listening', resolve));
    const base = `http://127.0.0.1:${server.address().port}`;
    const owner = {};
    const other = {};
    const request = async (path, { method = 'GET', body, jar = owner, headers = {}, expected = 200 } = {}) => {
      const response = await fetch(base + path, { method, headers: {
        Origin: 'http://localhost:5173', 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest',
        ...(jar.cookie ? { Cookie: jar.cookie } : {}), ...(jar.csrf ? { 'X-CSRF-Token': jar.csrf } : {}),
        'Idempotency-Key': randomUUID(), ...headers,
      }, ...(method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS' ? { body: JSON.stringify(body || {}) } : {}) });
      const data = response.status === 204 ? null : await response.json();
      assert.equal(response.status, expected, `${method} ${path}: ${JSON.stringify(data)}`);
      const cookie = response.headers.get('set-cookie');
      if (cookie) jar.cookie = cookie.split(';')[0];
      if (data?.data?.csrfToken) jar.csrf = data.data.csrfToken;
      return { ...data, response };
    };
    const registration = (email) => ({ name: 'Test Shopkeeper', shopName: 'Test Kirana', email, password: 'TestPassword42', confirmPassword: 'TestPassword42' });
    let customerId, productId, creditId, repaymentId;

    await t.test('public health and protected unauthenticated endpoints', async () => {
      await request('/api/health', { jar: {} });
      for (const path of ['/api/dashboard', '/api/customers', '/api/inventory', '/api/transactions', '/api/auth/me']) await request(path, { jar: {}, expected: 401 });
      await request('/api/voice/execute', { method: 'POST', jar: {}, expected: 401 });
    });
    await t.test('registration validation and normalized persisted account', async () => {
      await request('/api/auth/register', { method: 'POST', body: { ...registration('invalid@example.com'), password: 'short' }, expected: 400 });
      await request('/api/auth/register', { method: 'POST', body: { ...registration('mismatch@example.com'), confirmPassword: 'DifferentPassword42' }, expected: 400 });
      const result = await request('/api/auth/register', { method: 'POST', body: registration('  OWNER@Example.com '), expected: 201 });
      assert.equal(result.data.user.email, 'owner@example.com');
      assert.equal(result.data.user.shopName, 'Test Kirana');
      assert(!JSON.stringify(result.data).includes('passwordHash'));
      assert.match(result.response.headers.get('set-cookie'), /HttpOnly/);
      const user = await mongoose.models.User.findOne({ email: 'owner@example.com' }).select('+passwordHash');
      assert.match(user.passwordHash, /^\$2/);
      assert.notEqual(user.passwordHash, 'TestPassword42');
    });
    await t.test('duplicate email rejected regardless of case', async () => {
      await request('/api/auth/register', { method: 'POST', body: registration('OWNER@example.com'), expected: 409 });
    });
    await t.test('incorrect credentials rejected and login rotates session', async () => {
      await request('/api/auth/login', { method: 'POST', jar: {}, body: { email: 'owner@example.com', password: 'WrongPassword42' }, expected: 401 });
      const old = { ...owner };
      await request('/api/auth/login', { method: 'POST', body: { email: 'OWNER@example.com', password: 'TestPassword42' } });
      assert.notEqual(owner.cookie, old.cookie);
      await request('/api/auth/me', { jar: old, expected: 401 });
    });
    await t.test('session restoration and server expiry enforcement', async () => {
      const restored = await request('/api/auth/me', { jar: { cookie: owner.cookie } });
      assert.equal(restored.data.user.email, 'owner@example.com');
      assert.equal(restored.data.csrfToken, owner.csrf);
      assert.equal(await mongoose.models.Session.countDocuments(), 1);
      const expiredToken = 'a'.repeat(64);
      const { createHash } = await import('node:crypto');
      await mongoose.models.Session.create({ ownerId: restored.data.user.id, tokenHash: createHash('sha256').update(expiredToken).digest('hex'), csrfToken: 'expired', expiresAt: new Date(Date.now() - 1000) });
      await request('/api/auth/me', { jar: { cookie: `dukaansaathi=${expiredToken}` }, expected: 401 });
    });
    await t.test('CORS preflight covers all application headers and rejects foreign origins', async () => {
      for (const origin of ['http://localhost:5173', 'https://shop.example.com']) {
        const response = await fetch(base + '/api/customers', { method: 'OPTIONS', headers: { Origin: origin, 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'content-type,x-csrf-token,idempotency-key,cache-control,x-requested-with' } });
        assert.equal(response.status, 204);
        assert.equal(response.headers.get('access-control-allow-origin'), origin);
        assert.equal(response.headers.get('access-control-allow-credentials'), 'true');
      }
      await request('/api/dashboard', { headers: { Origin: 'https://attacker.example' }, expected: 403 });
    });
    await t.test('CSRF, form posts, and body operator injection are rejected', async () => {
      await request('/api/udhaar/customers', { method: 'POST', body: { name: 'Rejected' }, headers: { 'X-CSRF-Token': '' }, expected: 403 });
      await request('/api/auth/login', { method: 'POST', body: {}, headers: { 'X-Requested-With': '' }, expected: 403 });
      await request('/api/udhaar/customers', { method: 'POST', body: { name: { $ne: null } }, expected: 400 });
    });
    await t.test('create Mahesh and preserve after fresh API reads', async () => {
      const result = await request('/api/udhaar/customers', { method: 'POST', body: { name: 'Mahesh', phone: '9876543210', ownerId: new mongoose.Types.ObjectId() }, expected: 201 });
      customerId = result.data._id;
      assert.equal((await request('/api/customers?status=active')).data[0]._id, customerId);
      assert.equal((await request(`/api/udhaar/customers/${customerId}`)).data.name, 'Mahesh');
    });
    await t.test('older owned records missing isArchived remain active; unowned data stays hidden', async () => {
      const ownerId = (await mongoose.models.User.findOne({ email: 'owner@example.com' }))._id;
      await mongoose.models.Customer.collection.insertOne({ name: 'Old owned record', ownerId, totalUdhaar: 0 });
      await mongoose.models.Customer.collection.insertOne({ name: 'Unowned private demo', totalUdhaar: 999 });
      const list = (await request('/api/customers?status=active')).data;
      assert(list.some((customer) => customer.name === 'Old owned record'));
      assert(!list.some((customer) => customer.name === 'Unowned private demo'));
      assert.equal(await mongoose.models.Customer.collection.countDocuments({ ownerId: { $exists: false } }), 1);
    });
    await t.test('archive and restore customer persist and block new transactions', async () => {
      await request(`/api/udhaar/customers/${customerId}/archive`, { method: 'POST' });
      assert(!(await request('/api/customers?status=active')).data.some((customer) => customer._id === customerId));
      assert((await request('/api/customers?status=archived')).data.some((customer) => customer._id === customerId));
      await request('/api/udhaar/credit', { method: 'POST', body: { customerId, amount: 5 }, expected: 409 });
      await request(`/api/udhaar/customers/${customerId}/unarchive`, { method: 'POST' });
    });
    await t.test('delete unused customer and verify persistent absence', async () => {
      const unused = await request('/api/udhaar/customers', { method: 'POST', body: { name: 'Unused' }, expected: 201 });
      assert.equal((await request(`/api/udhaar/customers/${unused.data._id}`, { method: 'DELETE' })).action, 'deleted');
      await request(`/api/udhaar/customers/${unused.data._id}`, { expected: 404 });
    });
    await t.test('credit 100, repay 40, and verify balance 60 and saved history', async () => {
      const credit = await request('/api/udhaar/credit', { method: 'POST', body: { customerId, amount: 100 }, expected: 201 });
      creditId = credit.data.transaction._id;
      const repayment = await request('/api/udhaar/repay', { method: 'POST', body: { customerId, amount: 40 }, expected: 201 });
      repaymentId = repayment.data.transaction._id;
      assert.equal(repayment.data.customer.totalUdhaar, 60);
      const detail = (await request(`/api/udhaar/customers/${customerId}`)).data;
      assert.equal(detail.totalUdhaar, 60);
      assert.equal(detail.history.length, 2);
      assert.equal((await request('/api/dashboard')).data.outstandingUdhaar, 60);
      assert.equal((await request('/api/dashboard')).data.totalSales, 0);
    });
    await t.test('overpayments, invalid amounts, and missing request IDs are rejected without changes', async () => {
      for (const amount of [61, -1, 'NaN', true, 0.001]) await request('/api/udhaar/repay', { method: 'POST', body: { customerId, amount }, expected: 400 });
      await request('/api/udhaar/credit', { method: 'POST', body: { customerId, amount: 5 }, headers: { 'Idempotency-Key': '' }, expected: 400 });
      assert.equal((await request(`/api/udhaar/customers/${customerId}`)).data.totalUdhaar, 60);
    });
    await t.test('customers with history are archived and debt remains on dashboard', async () => {
      assert.equal((await request(`/api/udhaar/customers/${customerId}`, { method: 'DELETE' })).action, 'archived');
      assert.equal((await request('/api/dashboard')).data.outstandingUdhaar, 60);
      assert.equal((await request(`/api/udhaar/customers/${customerId}`)).data.history.length, 2);
      await request(`/api/udhaar/customers/${customerId}/unarchive`, { method: 'POST' });
    });
    await t.test('create 20 milk packets, reduce 5, and preserve threshold zero', async () => {
      const result = await request('/api/inventory', { method: 'POST', body: { name: 'Milk', price: 32, quantity: 20, lowStockThreshold: 0 }, expected: 201 });
      productId = result.data._id;
      assert.equal(result.data.lowStockThreshold, 0);
      assert.equal((await request('/api/inventory/adjust', { method: 'POST', body: { productId, quantityDelta: -5 } })).data.product.quantity, 15);
      assert.equal((await request(`/api/inventory/${productId}`)).data.quantity, 15);
      const sale = await request('/api/inventory/adjust', { method: 'POST', body: { productId, quantityDelta: -1, isSale: true } });
      assert.equal(sale.data.transaction.amount, 32);
      const dashboard = (await request('/api/dashboard')).data;
      assert.equal(dashboard.totalSales, 32);
      assert.equal(dashboard.dailySales.reduce((sum, day) => sum + day.sales, 0), 32);
      await request(`/api/transactions/${sale.data.transaction._id}/reverse`, { method: 'POST', body: { reason: 'Test sale reversal' } });
      assert.equal((await request('/api/dashboard')).data.totalSales, 0);
      assert.equal((await request(`/api/inventory/${productId}`)).data.quantity, 15);
    });
    await t.test('negative stock, malformed values, and historical product deletion are blocked', async () => {
      await request('/api/inventory/adjust', { method: 'POST', body: { productId, quantityDelta: -16 }, expected: 400 });
      await request(`/api/inventory/${productId}`, { method: 'PUT', body: { quantity: -1 }, expected: 400 });
      await request(`/api/inventory/${productId}`, { method: 'DELETE', expected: 409 });
      await request('/api/inventory', { method: 'POST', body: { name: 'Bad', quantity: 'oops' }, expected: 400 });
    });
    await t.test('retries and simultaneous duplicate requests save one transaction', async () => {
      const key = randomUUID();
      const options = { method: 'POST', body: { productId, quantityDelta: 2 }, headers: { 'Idempotency-Key': key } };
      const [first, second] = await Promise.all([request('/api/inventory/adjust', options), request('/api/inventory/adjust', options)]);
      assert.equal(first.data.transaction._id, second.data.transaction._id);
      assert.equal((await request(`/api/inventory/${productId}`)).data.quantity, 17);
      await request('/api/inventory/adjust', { ...options, body: { productId, quantityDelta: 3 }, expected: 409 });
    });
    await t.test('concurrent repayments cannot overdraw', async () => {
      const responses = await Promise.all([1, 2].map(() => fetch(base + '/api/udhaar/repay', { method: 'POST', headers: { Origin: 'http://localhost:5173', 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest', 'X-CSRF-Token': owner.csrf, Cookie: owner.cookie, 'Idempotency-Key': randomUUID() }, body: JSON.stringify({ customerId, amount: 40 }) })));
      assert.deepEqual(responses.map((response) => response.status).sort(), [201, 400]);
      assert.equal((await request(`/api/udhaar/customers/${customerId}`)).data.totalUdhaar, 20);
    });
    await t.test('reversal prevents negative balances and preserves audit metadata', async () => {
      await request(`/api/transactions/${creditId}/reverse`, { method: 'POST', body: { reason: 'Test' }, expected: 409 });
      const result = await request(`/api/transactions/${repaymentId}/reverse`, { method: 'POST', body: { reason: 'Correction' } });
      assert.equal(result.data.isReversed, true);
      assert.equal(result.data.reverseReason, 'Correction');
      await request(`/api/transactions/${repaymentId}/reverse`, { method: 'POST', body: { reason: 'Again' }, expected: 409 });
    });
    await t.test('voice Hindi credit, repayment, stock, and query intents are interpreted without writes', async () => {
      const before = await mongoose.models.Transaction.countDocuments();
      for (const [transcript, action] of [['Mahesh ko 100 rupaye udhaar do.', 'ADD_UDHAAR'], ['Mahesh ne 40 rupaye wapas diye.', 'RECORD_REPAYMENT'], ['Add 10 milk packets.', 'ADD_STOCK'], ['Reduce sugar stock by 2 packets.', 'REDUCE_STOCK'], ['Show my outstanding udhaar.', 'QUERY_UDHAAR']]) {
        assert.equal((await request('/api/voice/process', { method: 'POST', body: { transcript, language: 'hi-IN' } })).data.action, action);
      }
      assert.equal(await mongoose.models.Transaction.countDocuments(), before);
      assert.equal((await request('/api/voice/process', { method: 'POST', body: { transcript: 'Mahesh ko -5 rupaye udhaar do' } })).data.action, 'NEED_CLARIFICATION');
    });
    await t.test('voice execution requires confirmation and returns actual saved transaction', async () => {
      const body = { action: 'ADD_UDHAAR', customerName: 'Mahesh', amount: 10 };
      await request('/api/voice/execute', { method: 'POST', body, expected: 400 });
      const result = await request('/api/voice/execute', { method: 'POST', body: { ...body, confirmed: true } });
      assert(await mongoose.models.Transaction.exists({ _id: result.data.transaction._id }));
    });
    await t.test('shop isolation covers all ID-based reads and writes, voice, history, and dashboard', async () => {
      await request('/api/auth/register', { method: 'POST', jar: other, body: registration('other@example.com'), expected: 201 });
      for (const path of ['/api/customers', '/api/inventory', '/api/transactions']) assert.equal((await request(path, { jar: other })).data.length, 0);
      assert.equal((await request('/api/dashboard', { jar: other })).data.outstandingUdhaar, 0);
      const calls = [
        [`/api/udhaar/customers/${customerId}`, 'GET'], [`/api/udhaar/customers/${customerId}`, 'PUT', { name: 'Stolen' }],
        [`/api/udhaar/customers/${customerId}`, 'DELETE'], [`/api/udhaar/customers/${customerId}/archive`, 'POST'], [`/api/udhaar/customers/${customerId}/unarchive`, 'POST'],
        ['/api/udhaar/credit', 'POST', { customerId, amount: 1 }], ['/api/udhaar/repay', 'POST', { customerId, amount: 1 }],
        [`/api/inventory/${productId}`, 'GET'], [`/api/inventory/${productId}`, 'PUT', { quantity: 999 }], [`/api/inventory/${productId}`, 'DELETE'],
        ['/api/inventory/adjust', 'POST', { productId, quantityDelta: 1 }], [`/api/transactions/${creditId}/reverse`, 'POST'],
        ['/api/voice/execute', 'POST', { action: 'ADD_UDHAAR', customerId, customerName: 'Mahesh', amount: 1, confirmed: true }],
      ];
      for (const [path, method, body] of calls) await request(path, { method, body, jar: other, expected: 404 });
      assert.equal((await request('/api/voice/process', { method: 'POST', jar: other, body: { transcript: 'Mahesh ko 10 rupaye udhaar do' } })).data.customerContext, null);
    });
    await t.test('field allowlists ignore forged owner and balance updates', async () => {
      const original = (await request(`/api/inventory/${productId}`)).data;
      await request(`/api/inventory/${productId}`, { method: 'PUT', body: { ownerId: new mongoose.Types.ObjectId(), $set: { quantity: 999 } } });
      assert.equal((await request(`/api/inventory/${productId}`)).data.ownerId, original.ownerId);
      assert.equal((await request(`/api/inventory/${productId}`)).data.quantity, original.quantity);
      await request('/api/customers?search[evil]=x', { expected: 400 });
      await request('/api/transactions?limit=-1', { expected: 400 });
      const first = (await request('/api/transactions?limit=1&page=1')).data;
      const second = (await request('/api/transactions?limit=1&page=2')).data;
      assert.equal(first.length, 1);
      assert.notEqual(first[0]._id, second[0]._id);
    });
    await t.test('financial changes roll back if history insertion fails', async () => {
      const Transaction = mongoose.models.Transaction;
      const create = Transaction.create;
      const before = (await request(`/api/inventory/${productId}`)).data.quantity;
      Transaction.create = async () => { throw new Error('Simulated history write failure'); };
      try { await request('/api/inventory/adjust', { method: 'POST', body: { productId, quantityDelta: 1 }, expected: 500 }); }
      finally { Transaction.create = create; }
      assert.equal((await request(`/api/inventory/${productId}`)).data.quantity, before);
    });
    await t.test('production cookies are HttpOnly, Secure, host-only and SameSite=Lax', async () => {
      process.env.NODE_ENV = 'production';
      try {
        const result = await request('/api/auth/login', { method: 'POST', jar: {}, body: { email: 'owner@example.com', password: 'TestPassword42' } });
        const cookie = result.response.headers.get('set-cookie');
        assert.match(cookie, /^__Host-dukaansaathi=/);
        for (const attribute of ['HttpOnly', 'Secure', 'SameSite=Lax', 'Path=/']) assert(cookie.includes(attribute));
        assert(!cookie.includes('Domain='));
      } finally { process.env.NODE_ENV = 'test'; }
    });
    await t.test('rate limiting persists across requests and returns 429', async () => {
      const email = 'rate@example.com';
      const { createHash } = await import('node:crypto');
      const bucket = Math.floor(Date.now() / (15 * 60 * 1000));
      const id = createHash('sha256').update(`/login:email:${email}:${bucket}`).digest('hex');
      await mongoose.models.RateLimit.create({ _id: id, count: 15, expiresAt: new Date(Date.now() + 900000) });
      await request('/api/auth/login', { method: 'POST', jar: {}, body: { email, password: 'TestPassword42' }, expected: 429 });
    });
    await t.test('logout invalidates the server session, including a copied cookie', async () => {
      const copied = { ...owner };
      await request('/api/auth/logout', { method: 'POST' });
      await request('/api/auth/me', { jar: copied, expected: 401 });
    });
    await t.test('database outage returns 503 with CORS and never fake success', async () => {
      await mongoose.disconnect();
      const uri = process.env.MONGODB_URI;
      process.env.MONGODB_URI = '';
      try {
        const result = await request('/api/dashboard', { jar: other, expected: 503 });
        assert.equal(result.success, false);
        assert.equal(result.response.headers.get('access-control-allow-origin'), 'http://localhost:5173');
        assert(!JSON.stringify(result).includes(uri));
      } finally { process.env.MONGODB_URI = uri; }
    });
  } finally {
    if (server) await new Promise((resolve) => server.close(resolve));
    await mongoose.disconnect();
    await replica.stop();
  }
});
