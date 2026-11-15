import express from 'express';
import { getTransactions, reverseTransaction } from '../services/dataService.js';
import { sendApiError } from '../utils/apiErrors.js';

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const { type, search, limit } = req.query;
    const txns = await getTransactions({ type, search, limit });
    return res.json({ success: true, data: txns });
  } catch (error) {
    return sendApiError(res, error, 500);
  }
});

router.post('/:id/reverse', async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const reversed = await reverseTransaction(id, reason);
    return res.json({ success: true, data: reversed, message: 'Transaction reversed successfully' });
  } catch (error) {
    return sendApiError(res, error, 400);
  }
});

export default router;
