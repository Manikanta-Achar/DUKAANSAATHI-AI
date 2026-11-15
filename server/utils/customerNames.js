import { escapeRegex, text } from './validation.js';

export const cleanCustomerName = (value) => text(value, 'Customer name').normalize('NFKC').replace(/\s+/gu, ' ');
export const customerNameKey = (value) => cleanCustomerName(value).toLowerCase();
export const customerNamePattern = (value) => cleanCustomerName(value).split(' ').map(escapeRegex).join('\\s+');
export const exactCustomerName = (value) => ({ $regex: `^\\s*${customerNamePattern(value)}\\s*$`, $options: 'i' });
