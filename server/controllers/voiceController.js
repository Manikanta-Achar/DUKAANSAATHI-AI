import { parseShopCommand } from '../services/geminiService.js';
import {
  adjustStock,
  getDashboardStats,
  findProductByName,
} from '../services/dataService.js';
import { customerActions, prepareCustomerAction, executeCustomerAction } from '../services/customerAssistantService.js';
import { sendApiError } from '../utils/apiErrors.js';

export const processVoice = async (req, res) => {
  try {
    const { transcript, language } = req.body;
    if (typeof transcript !== 'string' || !transcript.trim() || transcript.length > 1000) {
      return res.status(400).json({ success: false, message: 'Voice transcript is required (maximum 1000 characters).' });
    }
    const proposedAction = await parseShopCommand(transcript, language);
    const customerPreview = customerActions.has(proposedAction.action)
      ? await prepareCustomerAction(req.user._id, proposedAction) : {};
    const product = proposedAction.productName ? await findProductByName(req.user._id, proposedAction.productName) : null;
    return res.json({ success: true, data: {
      ...proposedAction, customerContext: null, ...customerPreview,
      productContext: product ? { id: product._id, name: product.name, currentStock: product.quantity, unit: product.unit } : null,
    } });
  } catch (error) { return sendApiError(res, error); }
};

// Re-check edited fields and an explicit customer selection without another AI call.
export const previewCustomerAction = async (req, res) => {
  try {
    const { action, customerName, customerId, amount } = req.body;
    return res.json({ success: true, data: await prepareCustomerAction(req.user._id, { action, customerName, customerId, amount }) });
  } catch (error) { return sendApiError(res, error); }
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
      case 'ADD_UDHAAR':
      case 'RECORD_REPAYMENT':
      case 'CREATE_CUSTOMER': {
        result = await executeCustomerAction(req.user._id, {
          action, customerName, amount, description,
          customerId: req.body.customerId,
          createCustomer: req.body.createCustomer,
          restoreCustomer: req.body.restoreCustomer,
          requestKey: req.get('Idempotency-Key'),
        });
        const customer = result.customer;
        spokenConfirmation = action === 'CREATE_CUSTOMER'
          ? customer.name + (result.restoredCustomer ? ' restored.' : result.createdCustomer ? ' created.' : ' already exists.') + ' Outstanding balance: ₹' + customer.totalUdhaar + '.'
          : (action === 'ADD_UDHAAR' ? 'Added ₹' : 'Repaid ₹') + amount + ' for ' + customer.name + '. Outstanding balance: ₹' + customer.totalUdhaar + '.';
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
