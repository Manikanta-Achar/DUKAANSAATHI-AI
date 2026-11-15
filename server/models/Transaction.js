import mongoose from 'mongoose';

const transactionSchema = new mongoose.Schema(
  {
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Customer',
      default: null,
    },
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      default: null,
    },
    customerName: {
      type: String,
      trim: true,
      default: '',
    },
    productName: {
      type: String,
      trim: true,
      default: '',
    },
    type: {
      type: String,
      enum: ['credit', 'repayment', 'sale', 'stock_adjustment'],
      required: true,
    },
    amount: {
      type: Number,
      default: 0,
      min: 0,
    },
    quantity: {
      type: Number,
      default: 0,
    },
    description: {
      type: String,
      default: '',
      trim: true,
    },
    balanceAfter: {
      type: Number,
      default: 0,
    },
    isReversed: {
      type: Boolean,
      default: false,
    },
    reversedAt: {
      type: Date,
      default: null,
    },
    reverseReason: {
      type: String,
      default: '',
    },
  },
  { timestamps: true }
);

transactionSchema.index({ ownerId: 1, createdAt: -1 });
transactionSchema.index({ ownerId: 1, customerId: 1 });

export default mongoose.models.Transaction || mongoose.model('Transaction', transactionSchema);
