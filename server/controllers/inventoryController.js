import {
  getProducts,
  getProductById,
  createProduct,
  updateProduct as updateProductService,
  deleteProduct as deleteProductService,
  adjustStock,
} from '../services/dataService.js';

export const getInventory = async (req, res) => {
  try {
    const search = req.query.search || '';
    const products = await getProducts(search);
    return res.json({ success: true, data: products });
  } catch (error) {
    console.error('Error in getInventory:', error.message);
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const getSingleProduct = async (req, res) => {
  try {
    const product = await getProductById(req.params.id);
    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }
    return res.json({ success: true, data: product });
  } catch (error) {
    console.error('Error in getSingleProduct:', error.message);
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const createNewProduct = async (req, res) => {
  try {
    const { name, price, quantity, unit, lowStockThreshold } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Product name is required' });
    }
    const product = await createProduct({ name, price, quantity, unit, lowStockThreshold });
    return res.status(201).json({ success: true, data: product });
  } catch (error) {
    console.error('Error in createNewProduct:', error.message);
    return res.status(400).json({ success: false, message: error.message });
  }
};

export const updateProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const updated = await updateProductService(id, req.body);
    return res.json({ success: true, data: updated });
  } catch (error) {
    console.error('Error in updateProduct:', error.message);
    return res.status(400).json({ success: false, message: error.message });
  }
};

export const deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await deleteProductService(id);
    return res.json({ success: true, data: deleted, message: 'Product removed from inventory' });
  } catch (error) {
    console.error('Error in deleteProduct:', error.message);
    return res.status(400).json({ success: false, message: error.message });
  }
};

export const adjustStockController = async (req, res) => {
  try {
    const { productId, productName, quantityDelta, isSale, reason } = req.body;
    const result = await adjustStock({ productId, productName, quantityDelta, isSale, reason });
    return res.json({ success: true, data: result });
  } catch (error) {
    console.error('Error in adjustStockController:', error.message);
    return res.status(400).json({ success: false, message: error.message });
  }
};
