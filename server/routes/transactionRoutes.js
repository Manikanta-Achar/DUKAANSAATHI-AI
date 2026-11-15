import express from 'express';
import { getTransactions, reverseTransaction } from '../services/dataService.js';
import { sendApiError } from '../utils/apiErrors.js';

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const { type, search, limit, page } = req.query;
    const txns = await getTransactions(req.user._id, { type, search, limit, page });
    return res.json({ success: true, data: txns });
  } catch (error) {
    return sendApiError(res, error, 500);
  }
});

router.post('/:id/reverse', async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const reversed = await reverseTransaction(req.user._id, id, reason, req.get('Idempotency-Key'));
    return res.json({ success: true, data: reversed, message: 'Transaction reversed successfully' });
  } catch (error) {
    return sendApiError(res, error);
  }
});

export default router;
