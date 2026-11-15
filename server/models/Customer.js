import mongoose from 'mongoose';
import { cleanCustomerName, customerNameKey } from '../utils/customerNames.js';

const customerSchema = new mongoose.Schema(
  {
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    normalizedName: { type: String },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    phone: {
      type: String,
      trim: true,
      default: '',
    },
    totalUdhaar: {
      type: Number,
      default: 0,
      min: 0,
    },
    isArchived: {
      type: Boolean,
      default: false,
      index: true,
    },
    archivedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

customerSchema.index({ ownerId: 1, isArchived: 1, updatedAt: -1 });
// Legacy documents without this field stay untouched, including old duplicate names.
customerSchema.index({ ownerId: 1, normalizedName: 1 }, {
  unique: true,
  partialFilterExpression: { ownerId: { $type: 'objectId' }, normalizedName: { $type: 'string' } },
});
customerSchema.pre('validate', function () {
  if (this.isNew || this.isModified('name')) {
    this.name = cleanCustomerName(this.name);
    this.normalizedName = customerNameKey(this.name);
  }
});

export default mongoose.models.Customer || mongoose.model('Customer', customerSchema);
