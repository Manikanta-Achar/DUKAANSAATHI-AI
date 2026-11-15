import mongoose from 'mongoose';
import { createHash } from 'node:crypto';
import Customer from '../models/Customer.js';
import Product from '../models/Product.js';
import Transaction from '../models/Transaction.js';
import Operation from '../models/Operation.js';
import { connectDB } from '../config/db.js';
import { fail, text, number, objectId, escapeRegex } from '../utils/validation.js';
import { getInitialSeedData } from './seedData.js';
import { cleanCustomerName, customerNameKey, exactCustomerName } from '../utils/customerNames.js';

const scope = (ownerId) => ({ ownerId: objectId(ownerId, 'Owner') });
const byId = (ownerId, id) => ({ ...scope(ownerId), _id: objectId(id) });
const money = (value) => Math.round(value * 100) / 100;
const required = (record, label) => { if (!record) fail(`${label} not found.`, 404); return record; };
const nameQuery = (name) => ({ $regex: `^${escapeRegex(text(name, 'Name'))}$`, $options: 'i' });

async function atomic(work) {
  await connectDB();
  const session = await mongoose.startSession();
  try { return await session.withTransaction(() => work(session)); }
  finally { await session.endSession(); }
}

// Store the response in the SAME transaction as the ledger mutation. No partial success.
export async function financialWrite(ownerId, key, input, work) {
  text(key, 'Idempotency-Key', 128);
  await connectDB();
  await Operation.init();
  const owner = scope(ownerId);
  const fingerprint = createHash('sha256').update(JSON.stringify(input)).digest('hex');
  const replay = (operation) => {
    if (operation.fingerprint !== fingerprint) fail('This request ID was already used for a different operation.', 409);
    return operation.result;
  };
  try {
    return await atomic(async (session) => {
      const previous = await Operation.findOne({ ...owner, key }).session(session);
      if (previous) return replay(previous);
      const result = await work(session);
      const plain = JSON.parse(JSON.stringify(result));
      await Operation.create([{ ...owner, key, fingerprint, result: plain }], { session });
      return plain;
    });
  } catch (error) {
    if (error.code !== 11000) throw error;
    const previous = await Operation.findOne({ ...owner, key });
    if (!previous) throw error;
    return replay(previous);
  }
}

export async function getCustomers(ownerId, search = '', status = 'active') {
  await connectDB();
  if (!['active', 'archived', 'all'].includes(status)) fail('Customer status is invalid.');
  const query = scope(ownerId);
  if (status !== 'all') query.isArchived = status === 'archived' ? true : { $ne: true };
  const q = text(search, 'Search', 120, true);
  if (q) query.$or = ['name', 'phone'].map((field) => ({ [field]: { $regex: escapeRegex(q), $options: 'i' } }));
  const customers = await Customer.find(query).sort({ updatedAt: -1 }).lean();
  const counts = await Transaction.aggregate([
    { $match: { ...scope(ownerId), customerId: { $in: customers.map((customer) => customer._id) } } },
    { $group: { _id: '$customerId', count: { $sum: 1 } } },
  ]);
  const countMap = new Map(counts.map((entry) => [String(entry._id), entry.count]));
  return customers.map((customer) => ({ ...customer, isArchived: customer.isArchived === true, transactionCount: countMap.get(String(customer._id)) || 0 }));
}

export async function getCustomerById(ownerId, id) {
  await connectDB();
  const customer = await Customer.findOne(byId(ownerId, id)).lean();
  if (!customer) return null;
  const history = await Transaction.find({ ...scope(ownerId), customerId: customer._id }).sort({ createdAt: -1 }).lean();
  return { ...customer, isArchived: customer.isArchived === true, history, transactionCount: history.length };
}

export async function findCustomerByName(ownerId, name, session = null) {
  await connectDB();
  const matches = await Customer.find({ ...scope(ownerId), name: exactCustomerName(name) }).limit(2).session(session);
  if (matches.length > 1) fail('Multiple customers match. Select the customer in the ledger.', 409);
  return matches[0] || null;
}

export async function createCustomer(ownerId, { name, phone = '' }) {
  await connectDB();
  await Customer.init();
  const cleanName = cleanCustomerName(name);
  const cleanPhone = text(phone, 'Phone', 30, true);
  if (await Customer.exists({ ...scope(ownerId), name: exactCustomerName(cleanName) })) fail('A customer with this name already exists. Restore them from Archived if needed.', 409);
  return Customer.create({ ...scope(ownerId), name: cleanName, phone: cleanPhone });
}

export async function updateCustomer(ownerId, id, { name, phone = '' }) {
  await connectDB();
  await Customer.init();
  const cleanName = cleanCustomerName(name);
  const cleanPhone = text(phone, 'Phone', 30, true);
  return atomic(async (session) => {
    const duplicate = await Customer.exists({ ...scope(ownerId), _id: { $ne: objectId(id) }, name: exactCustomerName(cleanName) }).session(session);
    if (duplicate) fail('A customer with this name already exists.', 409);
    const customer = required(await Customer.findOneAndUpdate(byId(ownerId, id), { $set: { name: cleanName, normalizedName: customerNameKey(cleanName), phone: cleanPhone } }, { session, new: true, runValidators: true }), 'Customer');
    await Transaction.updateMany({ ...scope(ownerId), customerId: customer._id }, { $set: { customerName: cleanName } }, { session });
    return customer;
  });
}

export async function deleteCustomer(ownerId, id) {
  return atomic(async (session) => {
    const customer = required(await Customer.findOne(byId(ownerId, id)).session(session), 'Customer');
    const hasHistory = await Transaction.exists({ ...scope(ownerId), customerId: customer._id }).session(session);
    if (hasHistory || customer.totalUdhaar > 0) {
      customer.isArchived = true;
      customer.archivedAt = new Date();
      await customer.save({ session });
      return { action: 'archived', customer };
    }
    const result = await Customer.deleteOne(byId(ownerId, id), { session });
    if (result.deletedCount !== 1) fail('Customer could not be deleted.', 409);
    return { action: 'deleted', customer };
  });
}

async function setArchived(ownerId, id, archived) {
  await connectDB();
  const customer = required(await Customer.findOneAndUpdate(byId(ownerId, id), { $set: { isArchived: archived, archivedAt: archived ? new Date() : null } }, { new: true, runValidators: true }), 'Customer');
  return { action: archived ? 'archived' : 'unarchived', customer };
}
export const archiveCustomer = (ownerId, id) => setArchived(ownerId, id, true);
export const unarchiveCustomer = (ownerId, id) => setArchived(ownerId, id, false);

async function customerTransaction(ownerId, input, type) {
  const amount = number(input.amount, 'Amount', 0.01);
  const description = text(input.description, 'Description', 500, true) || (type === 'credit' ? 'Credit added' : 'Repayment received');
  return financialWrite(ownerId, input.requestKey, { type, customerId: input.customerId, customerName: input.customerName, amount, description }, async (session) => {
    const customer = required(input.customerId
      ? await Customer.findOne(byId(ownerId, input.customerId)).session(session)
      : await findCustomerByName(ownerId, input.customerName, session), 'Customer');
    if (customer.isArchived === true) fail('Restore this archived customer before recording transactions.', 409);
    if (type === 'repayment' && amount > customer.totalUdhaar) fail('Repayment cannot exceed the outstanding balance.');
    customer.totalUdhaar = money(customer.totalUdhaar + (type === 'credit' ? amount : -amount));
    if (customer.totalUdhaar > 1e10) fail('Balance is too large.');
    await customer.save({ session });
    const [transaction] = await Transaction.create([{ ...scope(ownerId), customerId: customer._id, customerName: customer.name, type, amount, description, balanceAfter: customer.totalUdhaar }], { session });
    return { customer, transaction };
  });
}
export const addUdhaar = (ownerId, input) => customerTransaction(ownerId, input, 'credit');
export const recordRepayment = (ownerId, input) => customerTransaction(ownerId, input, 'repayment');

export async function getProducts(ownerId, search = '') {
  await connectDB();
  const query = scope(ownerId);
  const q = text(search, 'Search', 120, true);
  if (q) query.name = { $regex: escapeRegex(q), $options: 'i' };
  return Product.find(query).sort({ updatedAt: -1 }).lean();
}
export async function getProductById(ownerId, id) {
  await connectDB();
  return Product.findOne(byId(ownerId, id)).lean();
}
export async function findProductByName(ownerId, name, session = null) {
  await connectDB();
  const clean = text(name, 'Product name').toLowerCase();
  const exact = await Product.find({ ...scope(ownerId), name: nameQuery(clean) }).limit(2).session(session);
  if (exact.length === 1) return exact[0];
  const tokens = clean.split(/\s+/).filter((token) => token.length > 1);
  if (!tokens.length) return null;
  const matches = await Product.find({ ...scope(ownerId), $or: tokens.map((token) => ({ name: { $regex: escapeRegex(token), $options: 'i' } })) }).limit(2).session(session);
  if (matches.length > 1) fail('Multiple products match. Use the full product name.', 409);
  return matches[0] || null;
}
function productFields(input, partial = false) {
  const fields = {};
  for (const [field, fallback] of Object.entries({ name: '', price: 0, quantity: 0, unit: 'packets', lowStockThreshold: 5 })) {
    if (partial && input[field] === undefined) continue;
    const value = input[field] ?? fallback;
    fields[field] = ['name', 'unit'].includes(field) ? text(value, field) : number(value, field);
  }
  return fields;
}
export async function createProduct(ownerId, input) {
  await connectDB();
  const fields = productFields(input);
  if (await Product.exists({ ...scope(ownerId), name: nameQuery(fields.name) })) fail('Product already exists. Use Add Stock to change its quantity.', 409);
  return Product.create({ ...scope(ownerId), ...fields });
}
export async function updateProduct(ownerId, id, input) {
  const fields = productFields(input, true); // Never accept ownerId or MongoDB operators.
  return atomic(async (session) => {
    const product = required(await Product.findOne(byId(ownerId, id)).session(session), 'Product');
    if (fields.name && await Product.exists({ ...scope(ownerId), _id: { $ne: product._id }, name: nameQuery(fields.name) }).session(session)) fail('Product name already exists.', 409);
    const delta = money((fields.quantity ?? product.quantity) - product.quantity);
    product.set(fields);
    await product.save({ session });
    if (delta) await Transaction.create([{ ...scope(ownerId), productId: product._id, productName: product.name, type: 'stock_adjustment', quantity: delta, balanceAfter: product.quantity, description: 'Stock corrected from inventory editor' }], { session });
    return product;
  });
}
export async function deleteProduct(ownerId, id) {
  return atomic(async (session) => {
    const product = required(await Product.findOne(byId(ownerId, id)).session(session), 'Product');
    if (await Transaction.exists({ ...scope(ownerId), productId: product._id }).session(session)) fail('Products with transaction history must be kept for audit and reversal.', 409);
    const result = await Product.deleteOne(byId(ownerId, id), { session });
    if (result.deletedCount !== 1) fail('Product could not be deleted.', 409);
    return product;
  });
}
export async function adjustStock(ownerId, input) {
  const delta = number(input.quantityDelta, 'Quantity change', -1e10);
  if (!delta) fail('Quantity change must be non-zero.');
  if (input.isSale !== undefined && typeof input.isSale !== 'boolean') fail('Sale flag is invalid.');
  if (input.isSale && delta >= 0) fail('A sale must reduce stock.');
  const reason = text(input.reason, 'Reason', 500, true);
  return financialWrite(ownerId, input.requestKey, { type: 'stock', productId: input.productId, productName: input.productName, delta, isSale: input.isSale === true, reason }, async (session) => {
    const product = required(input.productId ? await Product.findOne(byId(ownerId, input.productId)).session(session) : await findProductByName(ownerId, input.productName, session), 'Product');
    const target = money(product.quantity + delta);
    if (target < 0) fail(`Insufficient stock. Available: ${product.quantity}.`);
    if (target > 1e10) fail('Stock quantity is too large.');
    product.quantity = target;
    await product.save({ session });
    const [transaction] = await Transaction.create([{ ...scope(ownerId), productId: product._id, productName: product.name, type: input.isSale ? 'sale' : 'stock_adjustment', amount: input.isSale ? money(Math.abs(delta) * product.price) : 0, quantity: delta, description: reason || `Stock change: ${delta} ${product.unit}`, balanceAfter: target }], { session });
    return { product, transaction };
  });
}

export async function getTransactions(ownerId, { type, search = '', limit = 50, page = 1 } = {}) {
  await connectDB();
  const query = scope(ownerId);
  if (type && type !== 'all') {
    if (!['credit', 'repayment', 'sale', 'stock_adjustment'].includes(type)) fail('Transaction type is invalid.');
    query.type = type;
  }
  const q = text(search, 'Search', 120, true);
  if (q) query.$or = ['customerName', 'productName', 'description'].map((field) => ({ [field]: { $regex: escapeRegex(q), $options: 'i' } }));
  const count = number(limit, 'Limit', 1);
  if (!Number.isInteger(count) || count > 500) fail('Limit must be an integer from 1 to 500.');
  const pageNumber = number(page, 'Page', 1);
  if (!Number.isInteger(pageNumber) || pageNumber > 1000000) fail('Page is invalid.');
  return Transaction.find(query).sort({ createdAt: -1, _id: -1 }).skip((pageNumber - 1) * count).limit(count).lean();
}
export async function reverseTransaction(ownerId, id, reason = 'Entry correction', requestKey) {
  const cleanReason = text(reason, 'Reason', 500);
  return financialWrite(ownerId, requestKey, { type: 'reverse', id, reason: cleanReason }, async (session) => {
    const transaction = required(await Transaction.findOne(byId(ownerId, id)).session(session), 'Transaction');
    if (transaction.isReversed) fail('Transaction has already been reversed.', 409);
    if (transaction.customerId) {
      const customer = required(await Customer.findOne(byId(ownerId, transaction.customerId)).session(session), 'Customer');
      if (customer.isArchived === true) fail('Restore this customer before reversing a transaction.', 409);
      const balance = money(customer.totalUdhaar + (transaction.type === 'credit' ? -transaction.amount : transaction.amount));
      if (balance < 0) fail('Reverse the later repayments first; this reversal would make the balance negative.', 409);
      customer.totalUdhaar = balance;
      await customer.save({ session });
    } else if (transaction.productId) {
      const product = required(await Product.findOne(byId(ownerId, transaction.productId)).session(session), 'Product');
      const quantity = money(product.quantity - transaction.quantity);
      if (quantity < 0) fail('This reversal would make stock negative. Reverse later reductions first.', 409);
      product.quantity = quantity;
      await product.save({ session });
    }
    transaction.isReversed = true;
    transaction.reversedAt = new Date();
    transaction.reverseReason = cleanReason;
    await transaction.save({ session });
    return transaction;
  });
}

export async function getDashboardStats(ownerId) {
  await connectDB();
  const owner = scope(ownerId);
  const [customers, products, recentTransactions, sales] = await Promise.all([
    Customer.find(owner).lean(), getProducts(ownerId), getTransactions(ownerId, { limit: 6 }),
    Transaction.aggregate([{ $match: { ...owner, type: 'sale', isReversed: { $ne: true } } }, { $group: { _id: null, total: { $sum: '$amount' } } }]),
  ]);
  const dateKey = (date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
  const today = dateKey(new Date());
  const start = new Date(`${today}T00:00:00+05:30`);
  start.setTime(start.getTime() - 6 * 86400000);
  const dailySales = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(start.getTime() + i * 86400000);
    return { day: new Intl.DateTimeFormat('en', { weekday: 'short', timeZone: 'Asia/Kolkata' }).format(date), date: dateKey(date), sales: 0, udhaar: 0, repayments: 0 };
  });
  const dailyMap = new Map(dailySales.map((day) => [day.date, day]));
  const activity = await Transaction.find({ ...owner, createdAt: { $gte: start }, isReversed: { $ne: true } }).select('type amount createdAt').lean();
  for (const transaction of activity) {
    const day = dailyMap.get(dateKey(transaction.createdAt));
    const field = { sale: 'sales', credit: 'udhaar', repayment: 'repayments' }[transaction.type];
    if (day && field) day[field] = money(day[field] + transaction.amount);
  }
  const lowStockItems = products.filter((product) => product.quantity <= product.lowStockThreshold);
  return {
    totalSales: money(sales[0]?.total || 0),
    outstandingUdhaar: money(customers.reduce((sum, customer) => sum + (customer.totalUdhaar || 0), 0)),
    totalCustomers: customers.filter((customer) => customer.isArchived !== true).length,
    archivedCustomers: customers.filter((customer) => customer.isArchived === true).length,
    lowStockCount: lowStockItems.length, lowStockItems, recentTransactions, dailySales,
  };
}

// Append sample data only to an explicitly selected empty shop. Never reset data.
export async function seedDatabase(ownerId) {
  return atomic(async (session) => {
    const owner = scope(ownerId);
    for (const Model of [Customer, Product, Transaction]) {
      if (await Model.exists(owner).session(session)) fail('Demo data can only be added to an empty shop.', 409);
    }
    const seed = getInitialSeedData();
    const customers = await Customer.insertMany(seed.customers.map(({ _id, ...record }) => ({ ...record, ...owner })), { session });
    const products = await Product.insertMany(seed.products.map(({ _id, ...record }) => ({ ...record, ...owner })), { session });
    await Transaction.insertMany(seed.transactions.map(({ _id, ...record }) => ({ ...record, ...owner, customerId: customers.find((customer) => customer.name === record.customerName)?._id || null, productId: products.find((product) => product.name === record.productName)?._id || null })), { session });
    return { message: 'Sample data added to your empty shop.' };
  });
}
