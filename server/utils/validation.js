import mongoose from 'mongoose';
export function fail(message, statusCode = 400) { throw Object.assign(new Error(message), { statusCode }); }
export function text(value, label, max = 120, optional = false) {
  if (optional && (value === undefined || value === null)) return '';
  if (typeof value !== 'string' || value.trim().length > max || (!optional && !value.trim())) fail(`${label} is invalid.`);
  return value.trim();
}
export function number(value, label, min = 0) {
  if (!['number', 'string'].includes(typeof value) || value === '' || !Number.isFinite(Number(value)) || Number(value) < min || Math.abs(Number(value)) > 1e10) fail(`${label} is invalid.`);
  const result = Number(value);
  if (Math.abs(result * 100 - Math.round(result * 100)) > 0.0001) fail(`${label} must have at most two decimal places.`);
  return result;
}
export function objectId(value, label = 'ID') {
  if (!mongoose.isObjectIdOrHexString(value)) fail(`${label} is invalid.`);
  return new mongoose.Types.ObjectId(String(value));
}
export const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
