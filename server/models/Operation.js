import mongoose from 'mongoose';
const schema = new mongoose.Schema({
  ownerId: { type: mongoose.Schema.Types.ObjectId, required: true },
  key: { type: String, required: true },
  fingerprint: { type: String, required: true },
  result: { type: mongoose.Schema.Types.Mixed, required: true },
}, { timestamps: true });
schema.index({ ownerId: 1, key: 1 }, { unique: true });
export default mongoose.models.Operation || mongoose.model('Operation', schema);
