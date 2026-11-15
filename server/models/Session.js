import mongoose from 'mongoose';
const schema = new mongoose.Schema({
  tokenHash: { type: String, required: true, unique: true, select: false },
  ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  csrfToken: { type: String, required: true },
  expiresAt: { type: Date, required: true, expires: 0 },
}, { timestamps: true });
export default mongoose.models.Session || mongoose.model('Session', schema);
