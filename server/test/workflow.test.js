import assert from 'node:assert/strict';
import test from 'node:test';

process.env.NODE_ENV = 'test';
process.env.MONGODB_URI = '';
process.env.GEMINI_API_KEY = '';
delete process.env.VERCEL;

const data = await import('../services/dataService.js');
const { parseShopCommand } = await import('../services/geminiService.js');
const { executeVoiceAction, processVoice } = await import('../controllers/voiceController.js');
const { connectDB } = await import('../config/db.js');

function responseMock() {
  return {
    statusCode: 200,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
}

test('voice, customer, inventory, and dashboard workflows use validated services', async () => {
  const customer = await data.createCustomer({ name: 'Mahesh' });
  const creditCommand = await parseShopCommand('Mahesh ko 100 rupaye udhaar do', 'hi-IN');
  assert.equal(creditCommand.action, 'ADD_UDHAAR');
  assert.equal(creditCommand.customerName, 'Mahesh');
  assert.equal(creditCommand.amount, 100);

  const processedCredit = responseMock();
  await processVoice(
    { body: { transcript: 'Mahesh ko 100 rupaye udhaar do', language: 'hi-IN' } },
    processedCredit
  );
  assert.equal(processedCredit.body.data.customerContext.id, customer._id);

  const creditResult = responseMock();
  await executeVoiceAction(
    { body: { action: 'ADD_UDHAAR', customerName: 'Mahesh', amount: 100 } },
    creditResult
  );
  assert.equal(creditResult.body.success, true);

  const repaymentCommand = await parseShopCommand('Mahesh ne 40 rupaye wapas diye', 'hi-IN');
  assert.equal(repaymentCommand.action, 'RECORD_REPAYMENT');
  assert.equal(repaymentCommand.amount, 40);
  const repaymentResult = responseMock();
  await executeVoiceAction(
    { body: { action: 'RECORD_REPAYMENT', customerName: 'Mahesh', amount: 40 } },
    repaymentResult
  );
  assert.equal(repaymentResult.body.success, true);

  const ledger = await data.getCustomerById(customer._id);
  assert.equal(ledger.totalUdhaar, 60);
  assert.equal(ledger.history.length, 2);
  assert.equal((await data.getTransactions({ search: 'Mahesh' })).length, 2);

  const archive = await data.deleteCustomer(customer._id);
  assert.equal(archive.action, 'archived');
  const archivedLedger = await data.getCustomerById(customer._id);
  assert.equal(archivedLedger.totalUdhaar, 60);
  assert.equal(archivedLedger.history.length, 2);
  assert((await data.getCustomers('', 'active')).every((item) => String(item._id) !== customer._id));
  assert((await data.getCustomers('', 'archived')).some((item) => String(item._id) === customer._id));
  await data.unarchiveCustomer(customer._id);
  assert((await data.getCustomers('', 'active')).some((item) => String(item._id) === customer._id));

  const unused = await data.createCustomer({ name: 'Unused test customer' });
  assert.equal((await data.deleteCustomer(unused._id)).action, 'deleted');
  assert.equal(await data.getCustomerById(unused._id), null);

  const stockCommand = await parseShopCommand('Add 10 milk packets', 'en-IN');
  assert.equal(stockCommand.action, 'ADD_STOCK');
  assert.equal(stockCommand.quantity, 10);
  const product = await data.findProductByName(stockCommand.productName);
  assert(product);
  const originalQuantity = product.quantity;
  const stockResult = responseMock();
  await executeVoiceAction(
    {
      body: {
        action: 'ADD_STOCK',
        productName: stockCommand.productName,
        quantity: stockCommand.quantity,
      },
    },
    stockResult
  );
  assert.equal(stockResult.body.success, true);
  assert.equal((await data.getProductById(product._id)).quantity, originalQuantity + 10);

  const unknownCustomer = responseMock();
  await executeVoiceAction(
    { body: { action: 'ADD_UDHAAR', customerName: 'Not In Ledger', amount: 5 } },
    unknownCustomer
  );
  assert.equal(unknownCustomer.statusCode, 404);
  assert.equal(unknownCustomer.body.success, false);
  assert.equal(await data.findCustomerByName('Not In Ledger'), null);

  const dashboard = await data.getDashboardStats();
  assert(dashboard.totalCustomers > 0);
  assert(Array.isArray(dashboard.dailySales));
  assert.equal(dashboard.recentTransactions.length <= 6, true);

  const connectionError = await import('../config/db.js');
  process.env.NODE_ENV = 'production';
  await assert.rejects(connectionError.connectDB(), { name: 'DatabaseUnavailableError', statusCode: 503 });
});
