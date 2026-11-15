import express from 'express';
import {
  getInventory,
  getSingleProduct,
  createNewProduct,
  updateProduct,
  deleteProduct,
  adjustStockController,
} from '../controllers/inventoryController.js';

const router = express.Router();

router.get('/', getInventory);
router.get('/:id', getSingleProduct);
router.post('/', createNewProduct);
router.put('/:id', updateProduct);
router.delete('/:id', deleteProduct);
router.post('/adjust', adjustStockController);

export default router;
