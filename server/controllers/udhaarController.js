import {
  getCustomers,
  getCustomerById,
  createCustomer,
  updateCustomer as updateCustomerService,
  deleteCustomer as deleteCustomerService,
  archiveCustomer as archiveCustomerService,
  unarchiveCustomer as unarchiveCustomerService,
  addUdhaar,
  recordRepayment,
  getTransactions,
  reverseTransaction,
} from '../services/dataService.js';
import { sendApiError } from '../utils/apiErrors.js';

export const getUdhaar = async (req, res) => {
  try {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    const search = req.query.search || '';
    const status = req.query.status || 'active';
    const customers = await getCustomers(req.user._id, search, status);
    return res.json({ success: true, data: customers });
  } catch (error) {
    return sendApiError(res, error, 500);
  }
};

export const getCustomer = async (req, res) => {
  try {
    const customer = await getCustomerById(req.user._id, req.params.id);
    if (!customer) {
      return res.status(404).json({ success: false, message: 'Customer not found' });
    }
    return res.json({ success: true, data: customer });
  } catch (error) {
    return sendApiError(res, error, 500);
  }
};

export const addCustomer = async (req, res) => {
  try {
    const { name, phone } = req.body;
    if (typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Customer name is required' });
    }
    const customer = await createCustomer(req.user._id, { name, phone });
    return res.status(201).json({ success: true, data: customer });
  } catch (error) {
    return sendApiError(res, error);
  }
};

export const updateCustomer = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, phone } = req.body;
    if (typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Customer name is required' });
    }
    const updated = await updateCustomerService(req.user._id, id, { name, phone });
    return res.json({ success: true, data: updated, message: 'Customer updated successfully' });
  } catch (error) {
    return sendApiError(res, error);
  }
};

export const deleteCustomer = async (req, res) => {
  try {
    const { id } = req.params;
    const action = req.body?.action || req.query?.action;

    if (action === 'archive') {
      const result = await archiveCustomerService(req.user._id, id);
      return res.json({
        success: true,
        action: 'archived',
        data: result.customer,
        message: `Customer "${result.customer.name}" safely archived.`,
      });
    }

    const result = await deleteCustomerService(req.user._id, id);
    const archived = result.action === 'archived';
    return res.json({
      success: true,
      action: result.action,
      data: result.customer,
      message: archived
        ? `Customer "${result.customer.name}" safely archived.`
        : `Customer "${result.customer.name}" permanently deleted.`,
    });
  } catch (error) {
    return sendApiError(res, error);
  }
};

export const archiveCustomer = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await archiveCustomerService(req.user._id, id);
    return res.json({
      success: true,
      action: 'archived',
      data: result.customer,
      message: `Customer "${result.customer.name}" has been archived.`,
    });
  } catch (error) {
    return sendApiError(res, error);
  }
};

export const unarchiveCustomer = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await unarchiveCustomerService(req.user._id, id);
    return res.json({
      success: true,
      action: 'unarchived',
      data: result.customer,
      message: `Customer "${result.customer.name}" restored to active ledger.`,
    });
  } catch (error) {
    return sendApiError(res, error);
  }
};

export const createUdhaar = async (req, res) => {
  try {
    const { customerId, customerName, amount, description } = req.body;
    if (!amount || Number(amount) <= 0) {
      return res.status(400).json({ success: false, message: 'Valid positive amount is required' });
    }
    const result = await addUdhaar(req.user._id, { requestKey: req.get('Idempotency-Key'), customerId, customerName, amount, description });
    return res.status(201).json({ success: true, data: result });
  } catch (error) {
    return sendApiError(res, error);
  }
};

export const recordPayment = async (req, res) => {
  try {
    const { customerId, customerName, amount, description } = req.body;
    if (!amount || Number(amount) <= 0) {
      return res.status(400).json({ success: false, message: 'Valid positive amount is required' });
    }
    const result = await recordRepayment(req.user._id, { requestKey: req.get('Idempotency-Key'), customerId, customerName, amount, description });
    return res.status(201).json({ success: true, data: result });
  } catch (error) {
    return sendApiError(res, error);
  }
};

export const getHistory = async (req, res) => {
  try {
    const { type, search, limit, page } = req.query;
    const history = await getTransactions(req.user._id, { type, search, limit, page });
    return res.json({ success: true, data: history });
  } catch (error) {
    return sendApiError(res, error, 500);
  }
};

export const reverseEntry = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const reversed = await reverseTransaction(req.user._id, id, reason, req.get('Idempotency-Key'));
    return res.json({ success: true, data: reversed, message: 'Transaction reversed successfully' });
  } catch (error) {
    return sendApiError(res, error);
  }
};
