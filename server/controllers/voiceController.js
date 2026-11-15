import { parseShopCommand } from '../services/geminiService.js';
import {
  addUdhaar,
  recordRepayment,
  adjustStock,
  getDashboardStats,
  findCustomerByName,
  findProductByName,
} from '../services/dataService.js';

export const processVoice = async (req, res) => {
  try {
    const { transcript, language } = req.body;
    if (!transcript || !transcript.trim()) {
      return res.status(400).json({ success: false, message: 'Voice transcript is required' });
    }

    const proposedAction = await parseShopCommand(transcript, language);

    // Contextual lookup: if customer or product named, enrich with current system state
    let customerContext = null;
    let productContext = null;

    if (proposedAction.customerName) {
      customerContext = await findCustomerByName(proposedAction.customerName);
    }
    if (proposedAction.productName) {
      productContext = await findProductByName(proposedAction.productName);
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
    console.error('Error in processVoice:', error.message);
    return res.status(500).json({ success: false, message: error.message });
  }
};

export const executeVoiceAction = async (req, res) => {
  try {
    const { action, customerName, amount, productName, quantity, unit, description } = req.body;

    if (!action) {
      return res.status(400).json({ success: false, message: 'Action type is required' });
    }

    let result = null;
    let spokenConfirmation = '';

    switch (action) {
      case 'ADD_UDHAAR': {
        if (!customerName || !amount || Number(amount) <= 0) {
          return res.status(400).json({ success: false, message: 'Valid customer name and amount are required' });
        }
        result = await addUdhaar({
          customerName,
          amount: Number(amount),
          description: description || `Voice credit: ₹${amount}`,
        });
        spokenConfirmation = `${result.customer.name} के खाते में ₹${amount} उधार जोड़ दिया गया है। नया बकाया ₹${result.customer.totalUdhaar} है।`;
        break;
      }

      case 'RECORD_REPAYMENT': {
        if (!customerName || !amount || Number(amount) <= 0) {
          return res.status(400).json({ success: false, message: 'Valid customer name and amount are required' });
        }
        result = await recordRepayment({
          customerName,
          amount: Number(amount),
          description: description || `Voice repayment: ₹${amount}`,
        });
        spokenConfirmation = `${result.customer.name} से ₹${amount} की वापसी दर्ज हो गई। बाकी उधार ₹${result.customer.totalUdhaar} है।`;
        break;
      }

      case 'ADD_STOCK': {
        if (!productName || !quantity || Number(quantity) <= 0) {
          return res.status(400).json({ success: false, message: 'Valid product name and quantity are required' });
        }
        result = await adjustStock({
          productName,
          quantityDelta: Math.abs(Number(quantity)),
          isSale: false,
          reason: description || `Voice stock add: +${quantity}`,
        });
        spokenConfirmation = `${result.product.name} में ${quantity} स्टॉक जोड़ दिया गया है। कुल स्टॉक ${result.product.quantity} है।`;
        break;
      }

      case 'REDUCE_STOCK': {
        if (!productName || !quantity || Number(quantity) <= 0) {
          return res.status(400).json({ success: false, message: 'Valid product name and quantity are required' });
        }
        result = await adjustStock({
          productName,
          quantityDelta: -Math.abs(Number(quantity)),
          isSale: false,
          reason: description || `Voice stock reduction: -${quantity}`,
        });
        spokenConfirmation = `${result.product.name} से ${quantity} स्टॉक घटा दिया गया। अब बचा हुआ स्टॉक ${result.product.quantity} है।`;
        break;
      }

      case 'QUERY_UDHAAR': {
        const stats = await getDashboardStats();
        return res.json({
          success: true,
          action: 'QUERY_UDHAAR',
          data: stats,
          spokenConfirmation: `दुकान का कुल बकाया उधार ₹${stats.outstandingUdhaar} है।`,
        });
      }

      case 'QUERY_LOW_STOCK': {
        const stats = await getDashboardStats();
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
    console.error('Error in executeVoiceAction:', error.message);
    return res.status(400).json({ success: false, message: error.message });
  }
};
