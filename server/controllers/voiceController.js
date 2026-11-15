import { parseShopCommand } from '../services/geminiService.js';
import {
  addUdhaar,
  recordRepayment,
  adjustStock,
  getDashboardStats,
  findCustomerByName,
  findProductByName,
} from '../services/dataService.js';
import { sendApiError } from '../utils/apiErrors.js';

export const processVoice = async (req, res) => {
  try {
    const { transcript, language } = req.body;
    if (typeof transcript !== 'string' || !transcript.trim() || transcript.length > 1000) {
      return res.status(400).json({ success: false, message: 'Voice transcript is required' });
    }

    const proposedAction = await parseShopCommand(transcript, language);

    // Contextual lookup: if customer or product named, enrich with current system state
    let customerContext = null;
    let productContext = null;

    if (proposedAction.customerName) {
      customerContext = await findCustomerByName(req.user._id, proposedAction.customerName);
      if (customerContext?.isArchived) customerContext = null;
    }
    if (proposedAction.productName) {
      productContext = await findProductByName(req.user._id, proposedAction.productName);
    }

    return res.json({
      success: true,
      data: {
        ...proposedAction,
        customerContext: customerContext
          ? {
              id: customerContext._id,
              name: customerContext.name,
              currentUdhaar: customerContext.totalUdhaar,
            }
          : null,
        productContext: productContext
          ? {
              id: productContext._id,
              name: productContext.name,
              currentStock: productContext.quantity,
              unit: productContext.unit,
            }
          : null,
      },
    });
  } catch (error) {
    return sendApiError(res, error, 500);
  }
};

export const executeVoiceAction = async (req, res) => {
  try {
    if (req.body.confirmed !== true) return res.status(400).json({ success: false, message: 'Confirm the command preview before saving.' });
    const { action, customerName, amount, productName, quantity, unit, description } = req.body;

    if (!action) {
      return res.status(400).json({ success: false, message: 'Action type is required' });
    }

    let result = null;
    let spokenConfirmation = '';

    switch (action) {
      case 'ADD_UDHAAR': {
        const numericAmount = Number(amount);
        const cleanCustomerName = typeof customerName === 'string' ? customerName.trim() : '';
        if (!cleanCustomerName || !Number.isFinite(numericAmount) || numericAmount <= 0) {
          return res.status(400).json({ success: false, message: 'Valid customer name and amount are required' });
        }
        const customer = await findCustomerByName(req.user._id, cleanCustomerName);
        if (!customer || customer.isArchived) {
          return res.status(404).json({ success: false, message: 'Active customer not found' });
        }
        result = await addUdhaar(req.user._id, { requestKey: req.get('Idempotency-Key'),
          customerId: customer._id,
          customerName: customer.name,
          amount: numericAmount,
          description: description || `Voice credit: ₹${amount}`,
        });
        spokenConfirmation = `${result.customer.name} के खाते में ₹${amount} उधार जोड़ दिया गया है। नया बकाया ₹${result.customer.totalUdhaar} है।`;
        break;
      }

      case 'RECORD_REPAYMENT': {
        const numericAmount = Number(amount);
        const cleanCustomerName = typeof customerName === 'string' ? customerName.trim() : '';
        if (!cleanCustomerName || !Number.isFinite(numericAmount) || numericAmount <= 0) {
          return res.status(400).json({ success: false, message: 'Valid customer name and amount are required' });
        }
        const customer = await findCustomerByName(req.user._id, cleanCustomerName);
        if (!customer || customer.isArchived) {
          return res.status(404).json({ success: false, message: 'Active customer not found' });
        }
        result = await recordRepayment(req.user._id, { requestKey: req.get('Idempotency-Key'),
          customerId: customer._id,
          customerName: customer.name,
          amount: numericAmount,
          description: description || `Voice repayment: ₹${amount}`,
        });
        spokenConfirmation = `${result.customer.name} से ₹${amount} की वापसी दर्ज हो गई। बाकी उधार ₹${result.customer.totalUdhaar} है।`;
        break;
      }

      case 'ADD_STOCK': {
        const numericQuantity = Number(quantity);
        const cleanProductName = typeof productName === 'string' ? productName.trim() : '';
        if (!cleanProductName || !Number.isFinite(numericQuantity) || numericQuantity <= 0) {
          return res.status(400).json({ success: false, message: 'Valid product name and quantity are required' });
        }
        const product = await findProductByName(req.user._id, cleanProductName);
        if (!product) {
          return res.status(404).json({ success: false, message: 'Product not found in inventory' });
        }
        result = await adjustStock(req.user._id, { requestKey: req.get('Idempotency-Key'),
          productId: product._id,
          quantityDelta: numericQuantity,
          isSale: false,
          reason: description || `Voice stock add: +${quantity}`,
        });
        spokenConfirmation = `${result.product.name} में ${quantity} स्टॉक जोड़ दिया गया है। कुल स्टॉक ${result.product.quantity} है।`;
        break;
      }

      case 'REDUCE_STOCK': {
        const numericQuantity = Number(quantity);
        const cleanProductName = typeof productName === 'string' ? productName.trim() : '';
        if (!cleanProductName || !Number.isFinite(numericQuantity) || numericQuantity <= 0) {
          return res.status(400).json({ success: false, message: 'Valid product name and quantity are required' });
        }
        const product = await findProductByName(req.user._id, cleanProductName);
        if (!product) {
          return res.status(404).json({ success: false, message: 'Product not found in inventory' });
        }
        result = await adjustStock(req.user._id, { requestKey: req.get('Idempotency-Key'),
          productId: product._id,
          quantityDelta: -numericQuantity,
          isSale: false,
          reason: description || `Voice stock reduction: -${quantity}`,
        });
        spokenConfirmation = `${result.product.name} से ${quantity} स्टॉक घटा दिया गया। अब बचा हुआ स्टॉक ${result.product.quantity} है।`;
        break;
      }

      case 'QUERY_UDHAAR': {
        const stats = await getDashboardStats(req.user._id);
        return res.json({
          success: true,
          action: 'QUERY_UDHAAR',
          data: stats,
          spokenConfirmation: `दुकान का कुल बकाया उधार ₹${stats.outstandingUdhaar} है।`,
        });
      }

      case 'QUERY_LOW_STOCK': {
        const stats = await getDashboardStats(req.user._id);
        const count = stats.lowStockCount;
        return res.json({
          success: true,
          action: 'QUERY_LOW_STOCK',
          data: stats.lowStockItems,
          spokenConfirmation:
            count > 0 ? `दुकान में ${count} सामान कम स्टॉक में हैं।` : 'सभी सामान का पर्याप्त स्टॉक उपलब्ध है।',
        });
      }

      default:
        return res.status(400).json({ success: false, message: `Unsupported action: ${action}` });
    }

    return res.json({
      success: true,
      action,
      data: result,
      spokenConfirmation,
    });
  } catch (error) {
    return sendApiError(res, error);
  }
};
