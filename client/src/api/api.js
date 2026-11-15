import axios from 'axios';

let csrfToken = '';
export const setCsrfToken = (token = '') => { csrfToken = token; };
const pendingWrites = new Map();
const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || (import.meta.env.DEV ? 'http://localhost:5000' : ''),
  withCredentials: true,
  timeout: 20000,
});
api.interceptors.request.use((config) => {
  if (!['get', 'head', 'options'].includes(config.method)) {
    config.headers['Content-Type'] = 'application/json';
    config.headers['X-Requested-With'] = 'XMLHttpRequest';
    if (config.data === undefined) config.data = {};
    if (csrfToken) config.headers['X-CSRF-Token'] = csrfToken;
    if (/\/api\/(udhaar\/(credit|repay|reverse)|transactions\/.+\/reverse|inventory\/adjust|voice\/execute)/.test(config.url)) {
      const fingerprint = `${config.method}:${config.url}:${JSON.stringify(config.data)}`;
      config.writeFingerprint = fingerprint;
      if (!pendingWrites.has(fingerprint)) pendingWrites.set(fingerprint, crypto.randomUUID());
      config.headers['Idempotency-Key'] ||= pendingWrites.get(fingerprint);
    }
  }
  return config;
});
api.interceptors.response.use((response) => {
  if (response.data?.success === false) return Promise.reject(new Error(response.data.message || 'Request failed.'));
  pendingWrites.delete(response.config.writeFingerprint);
  return response;
}, (error) => {
  if (error.response && error.response.status < 500) pendingWrites.delete(error.config?.writeFingerprint);
  if (error.response?.status === 401 && !error.config?.url?.startsWith('/api/auth/')) window.dispatchEvent(new Event('session-expired'));
  return Promise.reject(error);
});
export default api;
