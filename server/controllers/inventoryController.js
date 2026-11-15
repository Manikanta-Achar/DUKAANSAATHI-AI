import {
  getProducts,
  getProductById,
  createProduct,
  updateProduct as updateProductService,
  deleteProduct as deleteProductService,
  adjustStock,
} from '../services/dataService.js';
import { sendApiError } from '../utils/apiErrors.js';

export const getInventory = async (req, res) => {
  try {
    const search = req.query.search || '';
    const products = await getProducts(req.user._id, search);
    return res.json({ success: true, data: products });
  } catch (error) {
    return sendApiError(res, error, 500);
  }
};

export const getSingleProduct = async (req, res) => {
  try {
    const product = await getProductById(req.user._id, req.params.id);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }
    return res.json({ success: true, data: product });
  } catch (error) {
    return sendApiError(res, error, 500);
  }
};

export const createNewProduct = async (req, res) => {
  try {
    const { name, price, quantity, unit, lowStockThreshold } = req.body;
    if (typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Product name is required' });
    }
    const product = await createProduct(req.user._id, { name, price, quantity, unit, lowStockThreshold });
    return res.status(201).json({ success: true, data: product });
  } catch (error) {
    return sendApiError(res, error);
  }
};

export const updateProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const updated = await updateProductService(req.user._id, id, req.body);
    return res.json({ success: true, data: updated });
  } catch (error) {
    return sendApiError(res, error);
  }
};

export const deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await deleteProductService(req.user._id, id);
    return res.json({ success: true, data: deleted, message: 'Product removed from inventory' });
  } catch (error) {
    return sendApiError(res, error);
  }
};

export const adjustStockController = async (req, res) => {
  try {
    const { productId, productName, quantityDelta, isSale, reason } = req.body;
    const result = await adjustStock(req.user._id, { requestKey: req.get('Idempotency-Key'), productId, productName, quantityDelta, isSale, reason });
    return res.json({ success: true, data: result });
  } catch (error) {
    return sendApiError(res, error);
  }
};
