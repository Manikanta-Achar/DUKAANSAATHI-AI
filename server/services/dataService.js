import Customer from '../models/Customer.js';
import Product from '../models/Product.js';
import Transaction from '../models/Transaction.js';
import { isDbConnected } from '../config/db.js';

// In-Memory store fallback when MongoDB is not connected
const memoryStore = {
  customers: [],
  products: [],
  transactions: [],
  idCounter: 1000,
  generateId() {
    this.idCounter += 1;
    return `mem_${Date.now()}_${this.idCounter}`;
  },
};

// Initial default seed dataset for small Indian Kirana / Chai shop
export function getInitialSeedData() {
  const now = new Date();
  const c1Id = 'cust_ramesh';
  const c2Id = 'cust_suresh';
  const c3Id = 'cust_anita';

  const customers = [
    {
      _id: c1Id,
      name: 'Ramesh',
      phone: '9876543210',
      totalUdhaar: 60,
      isArchived: false,
      archivedAt: null,
      createdAt: new Date(now.getTime() - 86400000 * 2),
      updatedAt: now,
    },
    {
      _id: c2Id,
      name: 'Suresh',
      phone: '9845123456',
      totalUdhaar: 150,
      isArchived: false,
      archivedAt: null,
      createdAt: new Date(now.getTime() - 86400000 * 5),
      updatedAt: now,
    },
    {
      _id: c3Id,
      name: 'Anita Sharma',
      phone: '9811223344',
      totalUdhaar: 0,
      isArchived: false,
      archivedAt: null,
      createdAt: new Date(now.getTime() - 86400000 * 7),
      updatedAt: now,
    },
  ];

  const products = [
    {
      _id: 'prod_milk',
      name: 'Amul Milk',
      price: 32,
      quantity: 15,
      unit: 'packets',
      lowStockThreshold: 10,
      createdAt: new Date(now.getTime() - 86400000 * 4),
      updatedAt: now,
    },
    {
      _id: 'prod_sugar',
      name: 'Tata Sugar',
      price: 45,
      quantity: 3,
      unit: 'kg',
      lowStockThreshold: 5,
      createdAt: new Date(now.getTime() - 86400000 * 4),
      updatedAt: now,
    },
    {
      _id: 'prod_tea',
      name: 'Red Label Tea',
      price: 120,
      quantity: 8,
      unit: 'packets',
      lowStockThreshold: 5,
      createdAt: new Date(now.getTime() - 86400000 * 4),
      updatedAt: now,
    },
    {
      _id: 'prod_oil',
      name: 'Fortune Mustard Oil',
      price: 140,
      quantity: 2,
      unit: 'litres',
      lowStockThreshold: 4,
      createdAt: new Date(now.getTime() - 86400000 * 4),
      updatedAt: now,
    },
    {
      _id: 'prod_parle',
      name: 'Parle-G Biscuits',
      price: 10,
      quantity: 25,
      unit: 'packets',
      lowStockThreshold: 10,
      createdAt: new Date(now.getTime() - 86400000 * 4),
      updatedAt: now,
    },
  ];

  const transactions = [
    {
      _id: 'txn_init_1',
      customerId: c1Id,
      customerName: 'Ramesh',
      productId: null,
      productName: '',
      type: 'credit',
      amount: 100,
      quantity: 0,
      description: 'Morning groceries udhaar',
      balanceAfter: 100,
      isReversed: false,
      createdAt: new Date(now.getTime() - 86400000 * 1.5),
      updatedAt: new Date(now.getTime() - 86400000 * 1.5),
    },
    {
      _id: 'txn_init_2',
      customerId: c1Id,
      customerName: 'Ramesh',
      productId: null,
      productName: '',
      type: 'repayment',
      amount: 40,
      quantity: 0,
      description: 'Evening cash repayment',
      balanceAfter: 60,
      isReversed: false,
      createdAt: new Date(now.getTime() - 86400000 * 1),
      updatedAt: new Date(now.getTime() - 86400000 * 1),
    },
    {
      _id: 'txn_init_3',
      customerId: null,
      customerName: '',
      productId: 'prod_milk',
      productName: 'Amul Milk',
      type: 'stock_adjustment',
      amount: 0,
      quantity: 20,
      description: 'Morning dairy delivery stock add',
      balanceAfter: 20,
      isReversed: false,
      createdAt: new Date(now.getTime() - 86400000 * 1),
      updatedAt: new Date(now.getTime() - 86400000 * 1),
    },
    {
      _id: 'txn_init_4',
      customerId: null,
      customerName: '',
      productId: 'prod_milk',
      productName: 'Amul Milk',
      type: 'sale',
      amount: 160,
      quantity: -5,
      description: 'Counter sale 5 packets milk',
      balanceAfter: 15,
      isReversed: false,
      createdAt: new Date(now.getTime() - 86400000 * 0.5),
      updatedAt: new Date(now.getTime() - 86400000 * 0.5),
    },
  ];

  return { customers, products, transactions };
}

// Auto-seed in-memory store on first load
function ensureMemoryInitialized() {
  if (memoryStore.customers.length === 0 && memoryStore.products.length === 0) {
    const seed = getInitialSeedData();
    memoryStore.customers = seed.customers;
    memoryStore.products = seed.products;
    memoryStore.transactions = seed.transactions;
  }
}

// ----------------- CUSTOMER SERVICES -----------------
function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export async function getCustomers(search = '', status = 'active') {
  if (isDbConnected()) {
    const query = {};
    if (status === 'archived') {
      query.isArchived = true;
    } else if (status === 'all') {
      // all
    } else {
      query.isArchived = { $ne: true };
    }

    if (search && search.trim()) {
      const q = search.trim();
      query.$or = [
        { name: { $regex: q, $options: 'i' } },
        { phone: { $regex: q, $options: 'i' } },
      ];
    }

    const list = await Customer.find(query).sort({ updatedAt: -1 }).lean();
    const custIds = list.map((c) => c._id);
    const counts = await Transaction.aggregate([
      { $match: { customerId: { $in: custIds } } },
      { $group: { _id: '$customerId', count: { $sum: 1 } } },
    ]);
    const countMap = {};
    counts.forEach((c) => {
      countMap[String(c._id)] = c.count;
    });

    return list.map((c) => ({
      ...c,
      transactionCount: countMap[String(c._id)] || 0,
    }));
  }

  ensureMemoryInitialized();
  const q = search.trim().toLowerCase();
  return memoryStore.customers
    .filter((c) => {
      if (status === 'archived') {
        if (!c.isArchived) return false;
      } else if (status === 'all') {
        // all
      } else {
        if (c.isArchived) return false;
      }

      if (q) {
        return (
          c.name.toLowerCase().includes(q) ||
          (c.phone && c.phone.includes(q))
        );
      }
      return true;
    })
    .map((c) => {
      const count = memoryStore.transactions.filter(
        (t) => String(t.customerId) === String(c._id)
      ).length;
      return { ...c, transactionCount: count };
    })
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
}

export async function getCustomerById(id) {
  if (isDbConnected()) {
    const customer = await Customer.findById(id).lean();
    if (!customer) return null;
    const history = await Transaction.find({ customerId: id }).sort({ createdAt: -1 }).lean();
    return { ...customer, history, transactionCount: history.length };
  }
  ensureMemoryInitialized();
  const customer = memoryStore.customers.find((c) => String(c._id) === String(id));
  if (!customer) return null;
  const history = memoryStore.transactions
    .filter((t) => String(t.customerId) === String(id))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  return { ...customer, history, transactionCount: history.length };
}

export async function findCustomerByName(name) {
  if (!name) return null;
  const clean = name.trim().toLowerCase();
  if (isDbConnected()) {
    return await Customer.findOne({ name: { $regex: new RegExp(`^${escapeRegex(clean)}$`, 'i') } });
  }
  ensureMemoryInitialized();
  return memoryStore.customers.find((c) => c.name.toLowerCase() === clean) || null;
}

export async function createCustomer({ name, phone = '' }) {
  if (!name || !name.trim()) throw new Error('Customer name is required');
  const cleanName = name.trim();

  if (isDbConnected()) {
    const existing = await Customer.findOne({
      name: { $regex: new RegExp(`^${escapeRegex(cleanName)}$`, 'i') },
    });
    if (existing) {
      if (existing.isArchived) {
        existing.isArchived = false;
        existing.archivedAt = null;
        await existing.save();
      }
      return existing;
    }
    const customer = new Customer({
      name: cleanName,
      phone: phone.trim(),
      totalUdhaar: 0,
      isArchived: false,
      archivedAt: null,
    });
    return await customer.save();
  }

  ensureMemoryInitialized();
  const existing = memoryStore.customers.find((c) => c.name.toLowerCase() === cleanName.toLowerCase());
  if (existing) {
    if (existing.isArchived) {
      existing.isArchived = false;
      existing.archivedAt = null;
      existing.updatedAt = new Date();
    }
    return existing;
  }

  const newCust = {
    _id: memoryStore.generateId(),
    name: cleanName,
    phone: phone.trim(),
    totalUdhaar: 0,
    isArchived: false,
    archivedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  memoryStore.customers.push(newCust);
  return newCust;
}

export async function updateCustomer(id, { name, phone = '' }) {
  if (!name || !name.trim()) throw new Error('Customer name is required');
  const cleanName = name.trim();
  const cleanPhone = phone ? phone.trim() : '';

  if (isDbConnected()) {
    const customer = await Customer.findById(id);
    if (!customer) throw new Error('Customer not found');
    customer.name = cleanName;
    customer.phone = cleanPhone;
    await customer.save();

    // Update customerName in Transaction records for audit consistency
    await Transaction.updateMany({ customerId: id }, { customerName: cleanName });
    return customer.toObject ? customer.toObject() : customer;
  }

  ensureMemoryInitialized();
  const customer = memoryStore.customers.find((c) => String(c._id) === String(id));
  if (!customer) throw new Error('Customer not found');
  customer.name = cleanName;
  customer.phone = cleanPhone;
  customer.updatedAt = new Date();

  memoryStore.transactions.forEach((t) => {
    if (String(t.customerId) === String(id)) {
      t.customerName = cleanName;
    }
  });
  return customer;
}

export async function deleteCustomer(id) {
  if (isDbConnected()) {
    const customer = await Customer.findById(id);
    if (!customer) throw new Error('Customer not found');

    const txnCount = await Transaction.countDocuments({ customerId: id });
    const hasBalance = Number(customer.totalUdhaar || 0) > 0;

    if (hasBalance || txnCount > 0) {
      customer.isArchived = true;
      customer.archivedAt = new Date();
      await customer.save();
      return {
        success: true,
        action: 'archived',
        customer: customer.toObject ? customer.toObject() : customer,
      };
    }

    const deletedCustomer = await Customer.findByIdAndDelete(id);
    if (!deletedCustomer) throw new Error('Customer not found');
    return { success: true, action: 'deleted', customer: deletedCustomer };
  }

  ensureMemoryInitialized();
  const index = memoryStore.customers.findIndex((c) => String(c._id) === String(id));
  if (index === -1) throw new Error('Customer not found');
  const customer = memoryStore.customers[index];

  const txnCount = memoryStore.transactions.filter((t) => String(t.customerId) === String(id)).length;
  const hasBalance = Number(customer.totalUdhaar || 0) > 0;

  if (hasBalance || txnCount > 0) {
    customer.isArchived = true;
    customer.archivedAt = new Date();
    customer.updatedAt = new Date();
    return { success: true, action: 'archived', customer };
  }

  const [removed] = memoryStore.customers.splice(index, 1);
  return { success: true, action: 'deleted', customer: removed };
}

export async function archiveCustomer(id) {
  if (isDbConnected()) {
    const customer = await Customer.findById(id);
    if (!customer) throw new Error('Customer not found');
    customer.isArchived = true;
    customer.archivedAt = new Date();
    await customer.save();
    return { success: true, action: 'archived', customer: customer.toObject ? customer.toObject() : customer };
  }

  ensureMemoryInitialized();
  const customer = memoryStore.customers.find((c) => String(c._id) === String(id));
  if (!customer) throw new Error('Customer not found');
  customer.isArchived = true;
  customer.archivedAt = new Date();
  customer.updatedAt = new Date();
  return { success: true, action: 'archived', customer };
}

export async function unarchiveCustomer(id) {
  if (isDbConnected()) {
    const customer = await Customer.findById(id);
    if (!customer) throw new Error('Customer not found');
    customer.isArchived = false;
    customer.archivedAt = null;
    await customer.save();
    return { success: true, action: 'unarchived', customer: customer.toObject ? customer.toObject() : customer };
  }

  ensureMemoryInitialized();
  const customer = memoryStore.customers.find((c) => String(c._id) === String(id));
  if (!customer) throw new Error('Customer not found');
  customer.isArchived = false;
  customer.archivedAt = null;
  customer.updatedAt = new Date();
  return { success: true, action: 'unarchived', customer };
}

// ----------------- UDHAAR & REPAYMENT -----------------
export async function addUdhaar({ customerId, customerName, amount, description = 'Credit added' }) {
  const numericAmount = Number(amount);
  if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
    throw new Error('Valid udhaar amount greater than 0 is required');
  }

  let customer = null;
  if (customerId) {
    customer = isDbConnected()
      ? await Customer.findById(customerId)
      : memoryStore.customers.find((c) => String(c._id) === String(customerId));
  } else if (customerName) {
    customer = await findCustomerByName(customerName);
  }

  if (!customer) throw new Error('Customer not found');
  if (customer.isArchived === true) throw new Error('Archived customers cannot receive new credit');

  const newBalance = Number(customer.totalUdhaar || 0) + numericAmount;

  if (isDbConnected()) {
    customer.totalUdhaar = newBalance;
    await customer.save();

    const transaction = new Transaction({
      customerId: customer._id,
      customerName: customer.name,
      type: 'credit',
      amount: numericAmount,
      quantity: 0,
      description,
      balanceAfter: newBalance,
    });
    await transaction.save();
    return { customer, transaction };
  }

  ensureMemoryInitialized();
  customer.totalUdhaar = newBalance;
  customer.updatedAt = new Date();

  const transaction = {
    _id: memoryStore.generateId(),
    customerId: customer._id,
    customerName: customer.name,
    productId: null,
    productName: '',
    type: 'credit',
    amount: numericAmount,
    quantity: 0,
    description,
    balanceAfter: newBalance,
    isReversed: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  memoryStore.transactions.unshift(transaction);
  return { customer, transaction };
}

export async function recordRepayment({ customerId, customerName, amount, description = 'Repayment received' }) {
  const numericAmount = Number(amount);
  if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
    throw new Error('Valid repayment amount greater than 0 is required');
  }

  let customer = null;
  if (customerId) {
    customer = isDbConnected()
      ? await Customer.findById(customerId)
      : memoryStore.customers.find((c) => String(c._id) === String(customerId));
  } else if (customerName) {
    customer = await findCustomerByName(customerName);
  }

  if (!customer) throw new Error(`Customer "${customerName || customerId}" not found for repayment`);
  if (customer.isArchived === true) throw new Error('Archived customers cannot record repayments');

  const currentBalance = Number(customer.totalUdhaar || 0);
  const newBalance = Math.max(0, currentBalance - numericAmount);

  if (isDbConnected()) {
    customer.totalUdhaar = newBalance;
    await customer.save();

    const transaction = new Transaction({
      customerId: customer._id,
      customerName: customer.name,
      type: 'repayment',
      amount: numericAmount,
      quantity: 0,
      description,
      balanceAfter: newBalance,
    });
    await transaction.save();
    return { customer, transaction };
  }

  ensureMemoryInitialized();
  customer.totalUdhaar = newBalance;
  customer.updatedAt = new Date();

  const transaction = {
    _id: memoryStore.generateId(),
    customerId: customer._id,
    customerName: customer.name,
    productId: null,
    productName: '',
    type: 'repayment',
    amount: numericAmount,
    quantity: 0,
    description,
    balanceAfter: newBalance,
    isReversed: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  memoryStore.transactions.unshift(transaction);
  return { customer, transaction };
}

// ----------------- INVENTORY SERVICES -----------------
export async function getProducts(search = '') {
  if (isDbConnected()) {
    const query = search ? { name: { $regex: search, $options: 'i' } } : {};
    return await Product.find(query).sort({ updatedAt: -1 }).lean();
  }
  ensureMemoryInitialized();
  const q = search.trim().toLowerCase();
  return memoryStore.products
    .filter((p) => !q || p.name.toLowerCase().includes(q))
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
}

export async function getProductById(id) {
  if (isDbConnected()) {
    return await Product.findById(id).lean();
  }
  ensureMemoryInitialized();
  return memoryStore.products.find((p) => String(p._id) === String(id)) || null;
}

export async function findProductByName(name) {
  if (!name) return null;
  const clean = name.trim().toLowerCase();
  if (isDbConnected()) {
    const exact = await Product.findOne({
      name: { $regex: new RegExp(`^${escapeRegex(clean)}$`, 'i') },
    });
    if (exact) return exact;

    const partialMatches = await Product.find({
      name: { $regex: escapeRegex(clean), $options: 'i' },
    }).limit(2);
    if (partialMatches.length === 1) return partialMatches[0];
    if (partialMatches.length > 1) return null;

    const tokens = clean.split(/\s+/).filter((token) => token.length > 1);
    const tokenMatches = await Product.find({
      $or: tokens.map((token) => ({ name: { $regex: escapeRegex(token), $options: 'i' } })),
    }).limit(2);
    return tokenMatches.length === 1 ? tokenMatches[0] : null;
  }
  ensureMemoryInitialized();
  const exact = memoryStore.products.find((p) => p.name.toLowerCase() === clean);
  if (exact) return exact;
  const partialMatches = memoryStore.products.filter((p) => p.name.toLowerCase().includes(clean));
  if (partialMatches.length === 1) return partialMatches[0];
  if (partialMatches.length > 1) return null;
  const tokens = clean.split(/\s+/).filter((token) => token.length > 1);
  const tokenMatches = memoryStore.products.filter((p) =>
    tokens.some((token) => p.name.toLowerCase().includes(token))
  );
  return tokenMatches.length === 1 ? tokenMatches[0] : null;
}

export async function createProduct({ name, price = 0, quantity = 0, unit = 'packets', lowStockThreshold = 5 }) {
  if (!name || !name.trim()) throw new Error('Product name is required');
  const cleanName = name.trim();
  const pPrice = Math.max(0, Number(price) || 0);
  const pQty = Math.max(0, Number(quantity) || 0);
  const pThreshold = Math.max(0, Number(lowStockThreshold) || 5);

  if (isDbConnected()) {
    const existing = await Product.findOne({ name: { $regex: new RegExp(`^${cleanName}$`, 'i') } });
    if (existing) {
      existing.quantity += pQty;
      if (pPrice > 0) existing.price = pPrice;
      await existing.save();
      return existing;
    }
    const product = new Product({
      name: cleanName,
      price: pPrice,
      quantity: pQty,
      unit: unit || 'packets',
      lowStockThreshold: pThreshold,
    });
    return await product.save();
  }

  ensureMemoryInitialized();
  const existing = memoryStore.products.find((p) => p.name.toLowerCase() === cleanName.toLowerCase());
  if (existing) {
    existing.quantity += pQty;
    if (pPrice > 0) existing.price = pPrice;
    existing.updatedAt = new Date();
    return existing;
  }

  const newProd = {
    _id: memoryStore.generateId(),
    name: cleanName,
    price: pPrice,
    quantity: pQty,
    unit: unit || 'packets',
    lowStockThreshold: pThreshold,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  memoryStore.products.push(newProd);
  return newProd;
}

export async function updateProduct(id, updates) {
  if (isDbConnected()) {
    const product = await Product.findByIdAndUpdate(id, updates, { new: true }).lean();
    if (!product) throw new Error('Product not found');
    return product;
  }
  ensureMemoryInitialized();
  const index = memoryStore.products.findIndex((p) => String(p._id) === String(id));
  if (index === -1) throw new Error('Product not found');
  memoryStore.products[index] = {
    ...memoryStore.products[index],
    ...updates,
    updatedAt: new Date(),
  };
  return memoryStore.products[index];
}

export async function deleteProduct(id) {
  if (isDbConnected()) {
    const product = await Product.findByIdAndDelete(id);
    if (!product) throw new Error('Product not found');
    return product;
  }
  ensureMemoryInitialized();
  const index = memoryStore.products.findIndex((p) => String(p._id) === String(id));
  if (index === -1) throw new Error('Product not found');
  const removed = memoryStore.products.splice(index, 1)[0];
  return removed;
}

export async function adjustStock({ productId, productName, quantityDelta, isSale = false, reason = '' }) {
  const delta = Number(quantityDelta);
  if (!Number.isFinite(delta) || delta === 0) throw new Error('Quantity change must be non-zero');

  let product = null;
  if (productId) {
    product = isDbConnected()
      ? await Product.findById(productId)
      : memoryStore.products.find((p) => String(p._id) === String(productId));
  } else if (productName) {
    product = await findProductByName(productName);
  }

  if (!product) throw new Error(`Product "${productName || productId}" not found in inventory`);

  const currentQty = Number(product.quantity || 0);
  const targetQty = currentQty + delta;

  if (targetQty < 0) {
    throw new Error(`Insufficient stock for "${product.name}". Available: ${currentQty}, Requested change: ${delta}`);
  }

  const txnType = isSale ? 'sale' : 'stock_adjustment';
  const txnAmount = isSale ? Math.abs(delta) * Number(product.price || 0) : 0;
  const defaultDesc = delta > 0 ? `Added ${delta} ${product.unit}` : `Reduced ${Math.abs(delta)} ${product.unit}`;

  if (isDbConnected()) {
    product.quantity = targetQty;
    await product.save();

    const transaction = new Transaction({
      productId: product._id,
      productName: product.name,
      type: txnType,
      amount: txnAmount,
      quantity: delta,
      description: reason || defaultDesc,
      balanceAfter: targetQty,
    });
    await transaction.save();
    return { product, transaction };
  }

  ensureMemoryInitialized();
  product.quantity = targetQty;
  product.updatedAt = new Date();

  const transaction = {
    _id: memoryStore.generateId(),
    customerId: null,
    customerName: '',
    productId: product._id,
    productName: product.name,
    type: txnType,
    amount: txnAmount,
    quantity: delta,
    description: reason || defaultDesc,
    balanceAfter: targetQty,
    isReversed: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  memoryStore.transactions.unshift(transaction);
  return { product, transaction };
}

// ----------------- TRANSACTIONS & REVERSAL -----------------
export async function getTransactions(filters = {}) {
  const { type, search, limit = 50 } = filters;

  if (isDbConnected()) {
    const query = {};
    if (type && type !== 'all') query.type = type;
    if (search) {
      query.$or = [
        { customerName: { $regex: search, $options: 'i' } },
        { productName: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
      ];
    }
    return await Transaction.find(query).sort({ createdAt: -1 }).limit(Number(limit)).lean();
  }

  ensureMemoryInitialized();
  let list = [...memoryStore.transactions];
  if (type && type !== 'all') {
    list = list.filter((t) => t.type === type);
  }
  if (search) {
    const q = search.toLowerCase();
    list = list.filter(
      (t) =>
        (t.customerName && t.customerName.toLowerCase().includes(q)) ||
        (t.productName && t.productName.toLowerCase().includes(q)) ||
        (t.description && t.description.toLowerCase().includes(q))
    );
  }
  return list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, Number(limit));
}

export async function reverseTransaction(transactionId, reason = 'Entry correction') {
  if (isDbConnected()) {
    const txn = await Transaction.findById(transactionId);
    if (!txn) throw new Error('Transaction not found');
    if (txn.isReversed) throw new Error('Transaction has already been reversed');

    // Revert impact
    if (txn.type === 'credit' && txn.customerId) {
      const cust = await Customer.findById(txn.customerId);
      if (cust) {
        cust.totalUdhaar = Math.max(0, cust.totalUdhaar - txn.amount);
        await cust.save();
      }
    } else if (txn.type === 'repayment' && txn.customerId) {
      const cust = await Customer.findById(txn.customerId);
      if (cust) {
        cust.totalUdhaar += txn.amount;
        await cust.save();
      }
    } else if ((txn.type === 'stock_adjustment' || txn.type === 'sale') && txn.productId) {
      const prod = await Product.findById(txn.productId);
      if (prod) {
        prod.quantity = Math.max(0, prod.quantity - txn.quantity);
        await prod.save();
      }
    }

    txn.isReversed = true;
    txn.reversedAt = new Date();
    txn.reverseReason = reason;
    await txn.save();
    return txn;
  }

  ensureMemoryInitialized();
  const txn = memoryStore.transactions.find((t) => String(t._id) === String(transactionId));
  if (!txn) throw new Error('Transaction not found');
  if (txn.isReversed) throw new Error('Transaction has already been reversed');

  if (txn.type === 'credit' && txn.customerId) {
    const cust = memoryStore.customers.find((c) => String(c._id) === String(txn.customerId));
    if (cust) cust.totalUdhaar = Math.max(0, cust.totalUdhaar - txn.amount);
  } else if (txn.type === 'repayment' && txn.customerId) {
    const cust = memoryStore.customers.find((c) => String(c._id) === String(txn.customerId));
    if (cust) cust.totalUdhaar += txn.amount;
  } else if ((txn.type === 'stock_adjustment' || txn.type === 'sale') && txn.productId) {
    const prod = memoryStore.products.find((p) => String(p._id) === String(txn.productId));
    if (prod) prod.quantity = Math.max(0, prod.quantity - txn.quantity);
  }

  txn.isReversed = true;
  txn.reversedAt = new Date();
  txn.reverseReason = reason;
  return txn;
}

// ----------------- DASHBOARD METRICS -----------------
export async function getDashboardStats() {
  const dbConnected = isDbConnected();
  const [customers, products] = await Promise.all([getCustomers(), getProducts()]);

  const startOfPeriod = new Date();
  startOfPeriod.setUTCHours(0, 0, 0, 0);
  startOfPeriod.setUTCDate(startOfPeriod.getUTCDate() - 6);

  let recentTransactions;
  let totalSales;
  let activityTransactions;
  if (dbConnected) {
    const [recent, sales, activity] = await Promise.all([
      getTransactions({ limit: 6 }),
      Transaction.aggregate([
        { $match: { type: 'sale', isReversed: { $ne: true } } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
      Transaction.find({
        createdAt: { $gte: startOfPeriod },
        isReversed: { $ne: true },
      })
        .select('type amount createdAt')
        .lean(),
    ]);
    recentTransactions = recent;
    totalSales = Number(sales[0]?.total) || 0;
    activityTransactions = activity;
  } else {
    ensureMemoryInitialized();
    const transactions = memoryStore.transactions;
    recentTransactions = await getTransactions({ limit: 6 });
    totalSales = transactions
      .filter((transaction) => transaction.type === 'sale' && !transaction.isReversed)
      .reduce((sum, transaction) => sum + (Number(transaction.amount) || 0), 0);
    activityTransactions = transactions.filter(
      (transaction) => new Date(transaction.createdAt) >= startOfPeriod && !transaction.isReversed
    );
  }

  // Outstanding Udhaar: Sum of all customers' totalUdhaar
  const outstandingUdhaar = customers.reduce((sum, c) => sum + (Number(c.totalUdhaar) || 0), 0);

  // Total customers count
  const totalCustomers = customers.length;

  // Low stock products count & items
  const lowStockItems = products.filter((p) => Number(p.quantity) <= Number(p.lowStockThreshold));
  const lowStockCount = lowStockItems.length;

  // Recent transactions (last 6)
  // Daily activity for the past 7 days
  const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const now = new Date();
  const dailyMap = {};

  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const dayName = daysOfWeek[d.getDay()];
    const dateKey = d.toISOString().split('T')[0];
    dailyMap[dateKey] = {
      day: dayName,
      date: dateKey,
      sales: 0,
      udhaar: 0,
      repayments: 0,
    };
  }

  activityTransactions.forEach((t) => {
    const dateKey = new Date(t.createdAt).toISOString().split('T')[0];
    if (dailyMap[dateKey]) {
      if (t.type === 'sale') {
        dailyMap[dateKey].sales += Number(t.amount) || 0;
      } else if (t.type === 'credit') {
        dailyMap[dateKey].udhaar += Number(t.amount) || 0;
      } else if (t.type === 'repayment') {
        dailyMap[dateKey].repayments += Number(t.amount) || 0;
      }
    }
  });

  const dailySales = Object.values(dailyMap);

  return {
    totalSales,
    outstandingUdhaar,
    totalCustomers,
    lowStockCount,
    lowStockItems,
    recentTransactions,
    dailySales,
  };
}

// ----------------- SEED DATA SERVICE -----------------
export async function seedDatabase(force = false) {
  const seed = getInitialSeedData();

  if (isDbConnected()) {
    const custCount = await Customer.countDocuments();
    if (custCount > 0 && !force) {
      return { message: 'Database already has records; seed skipped (set force=true to reload).' };
    }

    if (force) {
      await Customer.deleteMany({});
      await Product.deleteMany({});
      await Transaction.deleteMany({});
    }

    const createdCusts = await Customer.insertMany(
      seed.customers.map((c) => ({
        name: c.name,
        phone: c.phone,
        totalUdhaar: c.totalUdhaar,
        isArchived: false,
        archivedAt: null,
      }))
    );
    const custMap = {};
    createdCusts.forEach((c) => (custMap[c.name] = c._id));

    const createdProds = await Product.insertMany(
      seed.products.map((p) => ({
        name: p.name,
        price: p.price,
        quantity: p.quantity,
        unit: p.unit,
        lowStockThreshold: p.lowStockThreshold,
      }))
    );
    const prodMap = {};
    createdProds.forEach((p) => (prodMap[p.name] = p._id));

    const txnsToInsert = seed.transactions.map((t) => ({
      customerId: custMap[t.customerName] || null,
      productId: prodMap[t.productName] || null,
      customerName: t.customerName,
      productName: t.productName,
      type: t.type,
      amount: t.amount,
      quantity: t.quantity,
      description: t.description,
      balanceAfter: t.balanceAfter,
    }));
    await Transaction.insertMany(txnsToInsert);

    return { message: 'Demo seed data successfully loaded into MongoDB!' };
  }

  // In-memory seed
  memoryStore.customers = seed.customers;
  memoryStore.products = seed.products;
  memoryStore.transactions = seed.transactions;
  return { message: 'Demo seed data successfully loaded into In-Memory Store!' };
}
