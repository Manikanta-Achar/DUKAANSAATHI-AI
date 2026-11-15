import Customer from '../models/Customer.js';
import Transaction from '../models/Transaction.js';
import { connectDB } from '../config/db.js';
import { financialWrite } from './dataService.js';
import { cleanCustomerName, customerNameKey, customerNamePattern, exactCustomerName } from '../utils/customerNames.js';
import { fail, number, objectId, text } from '../utils/validation.js';

export const customerActions = new Set(['ADD_UDHAAR', 'RECORD_REPAYMENT', 'CREATE_CUSTOMER']);
const ownerScope = (ownerId) => ({ ownerId: objectId(ownerId, 'Owner') });
const context = (customer) => ({ id: String(customer._id), name: cleanCustomerName(customer.name), phone: customer.phone || '', currentUdhaar: customer.totalUdhaar || 0, isArchived: customer.isArchived === true });

async function resolveCustomer(ownerId, name, customerId, session = null) {
  const owner = ownerScope(ownerId);
  if (customerId) {
    const customer = await Customer.findOne({ ...owner, _id: objectId(customerId, 'Customer ID') }).session(session);
    if (!customer) fail('Customer not found.', 404);
    return { status: customer.isArchived === true ? 'archived' : 'active', customer };
  }
  let matches = await Customer.find({ ...owner, name: exactCustomerName(name) }).limit(21).session(session);
  if (matches.length === 1) return { status: matches[0].isArchived === true ? 'archived' : 'active', customer: matches[0] };
  if (!matches.length) {
    matches = await Customer.find({ ...owner, name: { $regex: `(^|\\s)${customerNamePattern(name)}(\\s|$)`, $options: 'i' } }).limit(21).session(session);
  }
  if (matches.length) return { status: 'ambiguous', candidates: matches.slice(0, 20), hasMoreMatches: matches.length > 20 };
  return { status: 'missing', customer: null };
}

export async function prepareCustomerAction(ownerId, input) {
  await connectDB();
  if (!customerActions.has(input.action)) fail('Unsupported customer action.');
  const customerName = cleanCustomerName(input.customerName);
  const amount = input.action === 'CREATE_CUSTOMER' ? 0 : number(input.amount, 'Amount', 0.01);
  const match = await resolveCustomer(ownerId, customerName, input.customerId);
  const name = match.customer ? cleanCustomerName(match.customer.name) : customerName;
  let canConfirm = true;
  let confirmationMessage;
  switch (match.status) {
    case 'ambiguous':
      canConfirm = false;
      confirmationMessage = 'Similar customers exist. Select the correct customer before confirming, or enter a more specific name.';
      break;
    case 'missing':
      canConfirm = input.action !== 'RECORD_REPAYMENT';
      confirmationMessage = input.action === 'ADD_UDHAAR'
        ? `${name} is a new customer. Create ${name} and add ₹${amount} udhaar?`
        : input.action === 'CREATE_CUSTOMER' ? `Create ${name} as a new customer with ₹0 outstanding balance?`
          : `${name} is not an active customer. Repayments require an existing active customer.`;
      break;
    case 'archived':
      canConfirm = input.action !== 'RECORD_REPAYMENT';
      confirmationMessage = input.action === 'ADD_UDHAAR'
        ? `${name} is archived. Restore ${name} and add ₹${amount} udhaar?`
        : input.action === 'CREATE_CUSTOMER' ? `${name} is archived. Restore the existing customer?`
          : `${name} is archived. Restore this customer in the Udhaar Ledger before recording a repayment.`;
      break;
    default:
      if (input.action === 'RECORD_REPAYMENT' && amount > match.customer.totalUdhaar) {
        canConfirm = false;
        confirmationMessage = `Repayment cannot exceed ${name}'s outstanding balance of ₹${match.customer.totalUdhaar}.`;
      } else {
        confirmationMessage = input.action === 'ADD_UDHAAR' ? `Add ₹${amount} udhaar to ${name}?`
          : input.action === 'RECORD_REPAYMENT' ? `Record ₹${amount} repayment from ${name}?`
            : `${name} already exists. Keep the existing customer without creating a duplicate?`;
      }
  }
  return {
    action: input.action, customerName: name, amount,
    customerStatus: match.status, customerContext: match.customer ? context(match.customer) : null,
    customerCandidates: (match.candidates || []).map(context), hasMoreMatches: match.hasMoreMatches || false,
    canConfirm, confirmationMessage,
  };
}

export async function executeCustomerAction(ownerId, input) {
  if (!customerActions.has(input.action)) fail('Unsupported customer action.');
  const customerName = cleanCustomerName(input.customerName);
  const amount = input.action === 'CREATE_CUSTOMER' ? 0 : number(input.amount, 'Amount', 0.01);
  const description = text(input.description, 'Description', 500, true) || 'Voice/text assistant';
  const createCustomer = input.createCustomer === true && input.action !== 'RECORD_REPAYMENT';
  const restoreCustomer = input.restoreCustomer === true && input.action !== 'RECORD_REPAYMENT';
  await connectDB();
  await Customer.init();
  try {
    return await financialWrite(ownerId, input.requestKey, {
      type: 'assistant_customer', action: input.action, customerName: customerNameKey(customerName),
      customerId: input.customerId || null, amount, description, createCustomer, restoreCustomer,
    }, async (session) => {
      // Re-resolve inside the transaction; never trust stale preview state or a body ownerId.
      const match = await resolveCustomer(ownerId, customerName, input.customerId, session);
      if (match.status === 'ambiguous') fail('Similar customers exist. Select a customer and review the preview again.', 409);
      let customer = match.customer;
      let createdCustomer = false;
      let restoredCustomer = false;
      if (!customer) {
        if (input.action === 'RECORD_REPAYMENT') fail('Active customer not found. Repayments never create customers.', 404);
        if (!createCustomer) fail('Review and confirm creation of this new customer first.', 409);
        [customer] = await Customer.create([{ ...ownerScope(ownerId), name: customerName, totalUdhaar: 0, isArchived: false }], { session });
        createdCustomer = true;
      } else if (customer.isArchived === true) {
        if (!restoreCustomer) fail('This customer is archived. Confirm restoration of the existing customer first.', 409);
        customer.isArchived = false;
        customer.archivedAt = null;
        restoredCustomer = true;
      }
      let transaction = null;
      if (input.action !== 'CREATE_CUSTOMER') {
        if (input.action === 'RECORD_REPAYMENT' && amount > customer.totalUdhaar) fail('Repayment cannot exceed the outstanding balance.');
        customer.totalUdhaar = Math.round((customer.totalUdhaar + (input.action === 'ADD_UDHAAR' ? amount : -amount)) * 100) / 100;
        if (customer.totalUdhaar > 1e10) fail('Balance is too large.');
        await customer.save({ session });
        [transaction] = await Transaction.create([{
          ...ownerScope(ownerId), customerId: customer._id, customerName: customer.name,
          type: input.action === 'ADD_UDHAAR' ? 'credit' : 'repayment', amount, description, balanceAfter: customer.totalUdhaar,
        }], { session });
      } else if (restoredCustomer) await customer.save({ session });
      return { customer, transaction, createdCustomer, restoredCustomer };
    });
  } catch (error) {
    if (error.code === 11000) fail('A customer with this name was just created. Review the customer preview again.', 409);
    throw error;
  }
}
