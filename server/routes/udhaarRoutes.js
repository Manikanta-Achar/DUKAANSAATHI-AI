import express from 'express';
import {
  getUdhaar,
  getCustomer,
  addCustomer,
  updateCustomer,
  deleteCustomer,
  archiveCustomer,
  unarchiveCustomer,
  createUdhaar,
  recordPayment,
  getHistory,
  reverseEntry,
} from '../controllers/udhaarController.js';

const router = express.Router();

router.get('/customers', getUdhaar);
router.get('/customers/:id', getCustomer);
router.post('/customers', addCustomer);
router.put('/customers/:id', updateCustomer);
router.delete('/customers/:id', deleteCustomer);
router.post('/customers/:id/archive', archiveCustomer);
router.post('/customers/:id/unarchive', unarchiveCustomer);
router.post('/credit', createUdhaar);
router.post('/repay', recordPayment);
router.get('/history', getHistory);
router.post('/reverse/:id', reverseEntry);

export default router;
