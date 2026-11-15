import {
  getCustomers,
  getCustomerById,
  createCustomer,
  addUdhaar,
  recordRepayment,
  getTransactions,
  reverseTransaction,
} from '../services/dataService.js';

export const getUdhaar = async (req, res) => {
  try {
    const search = req.query.search || '';
    const customers = await getCustomers(search);
    return res.json({ success: true, data: customers });
  } catch (error) {
    console.error('Error in getUdhaar:', error.message);
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getCustomer = async (req, res) => {
  try {
    const customer = await getCustomerById(req.params.id);
    if (!customer) {
      return res.status(404).json({ success: false, message: 'Customer not found' });
    }
    return res.json({ success: true, data: customer });
  } catch (error) {
    console.error('Error in getCustomer:', error.message);
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const addCustomer = async (req, res) => {
  try {
    const { name, phone } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Customer name is required' });
    }
    const customer = await createCustomer({ name, phone });
    return res.status(201).json({ success: true, data: customer });
  } catch (error) {
    console.error('Error in addCustomer:', error.message);
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const createUdhaar = async (req, res) => {
  try {
    const { customerId, customerName, amount, description } = req.body;
    if (!amount || Number(amount) <= 0) {
      return res.status(400).json({ success: false, message: 'Valid positive amount is required' });
    }
    const result = await addUdhaar({ customerId, customerName, amount, description });
    return res.status(201).json({ success: true, data: result });
  } catch (error) {
    console.error('Error in createUdhaar:', error.message);
    return res.status(400).json({ success: false, message: error.message });
  }
};

export const recordPayment = async (req, res) => {
  try {
    const { customerId, customerName, amount, description } = req.body;
    if (!amount || Number(amount) <= 0) {
      return res.status(400).json({ success: false, message: 'Valid positive amount is required' });
    }
    const result = await recordRepayment({ customerId, customerName, amount, description });
    return res.status(201).json({ success: true, data: result });
  } catch (error) {
    console.error('Error in recordPayment:', error.message);
    return res.status(400).json({ success: false, message: error.message });
  }
};

export const getHistory = async (req, res) => {
  try {
    const { type, search, limit } = req.query;
    const history = await getTransactions({ type, search, limit });
    return res.json({ success: true, data: history });
  } catch (error) {
    console.error('Error in getHistory:', error.message);
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const reverseEntry = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const reversed = await reverseTransaction(id, reason);
    return res.json({ success: true, data: reversed, message: 'Transaction reversed successfully' });
  } catch (error) {
    console.error('Error in reverseEntry:', error.message);
    return res.status(400).json({ success: false, message: error.message });
  }
};
