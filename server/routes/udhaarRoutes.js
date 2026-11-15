import express from 'express';
import {
  getUdhaar,
  getCustomer,
  addCustomer,
  createUdhaar,
  recordPayment,
  getHistory,
  reverseEntry,
} from '../controllers/udhaarController.js';

const router = express.Router();

router.get('/customers', getUdhaar);
router.get('/customers/:id', getCustomer);
router.post('/customers', addCustomer);
router.post('/credit', createUdhaar);
router.post('/repay', recordPayment);
router.get('/history', getHistory);
router.post('/reverse/:id', reverseEntry);

export default router;
