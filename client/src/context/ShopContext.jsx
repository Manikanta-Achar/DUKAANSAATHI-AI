import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import api from '../api/api.js';

export const ShopContext = createContext(null);
export function ShopProvider({ children }) {
  const [dashboard, setDashboard] = useState({ totalSales: 0, outstandingUdhaar: 0, totalCustomers: 0, archivedCustomers: 0, lowStockCount: 0, recentTransactions: [], lowStockItems: [], dailySales: [] });
  const [customers, setCustomers] = useState([]);
  const [customersLoading, setCustomersLoading] = useState(true);
  const [products, setProducts] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errors, setErrors] = useState({});
  const requestIds = useRef({});
  const transactionFilters = useRef({});
  const [speechLang, setSpeechLang] = useState('hi-IN');
  const [isVoiceModalOpen, setIsVoiceModalOpen] = useState(false);
  const [toast, setToast] = useState({ message: '', type: 'success', visible: false });
  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type, visible: true });
    setTimeout(() => setToast((previous) => ({ ...previous, visible: false })), 4000);
  }, []);
  const fetchData = useCallback(async (key, url, setter, array = false) => {
    const id = requestIds.current[key] = (requestIds.current[key] || 0) + 1;
    try {
      const response = await api.get(url);
      const data = response.data?.data;
      if (!response.data?.success || (array ? !Array.isArray(data) : !data)) throw new Error('Unexpected API response.');
      if (requestIds.current[key] !== id) return true;
      setter(data);
      setErrors((previous) => ({ ...previous, [key]: '' }));
      return true;
    } catch (err) {
      if (requestIds.current[key] === id) setErrors((previous) => ({ ...previous, [key]: `${key}: ${err.response?.data?.message || err.message}` }));
      return false;
    }
  }, []);
  const refreshDashboard = useCallback(() => fetchData('Dashboard', '/api/dashboard', setDashboard), [fetchData]);
  const refreshCustomers = useCallback(async () => {
    const id = (requestIds.current.Customers || 0) + 1;
    setCustomersLoading(true);
    try { return await fetchData('Customers', '/api/udhaar/customers?status=all', setCustomers, true); }
    finally { if (requestIds.current.Customers === id) setCustomersLoading(false); }
  }, [fetchData]);
  const refreshProducts = useCallback(() => fetchData('Inventory', '/api/inventory', setProducts, true), [fetchData]);
  const refreshTransactions = useCallback((filters) => {
    if (filters) transactionFilters.current = filters;
    return fetchData('History', `/api/transactions?${new URLSearchParams(transactionFilters.current)}`, setTransactions, true);
  }, [fetchData]);
  const refreshAll = useCallback(async () => {
    setLoading(true);
    try { return (await Promise.all([refreshDashboard(), refreshCustomers(), refreshProducts(), refreshTransactions()])).every(Boolean); }
    finally { setLoading(false); }
  }, [refreshDashboard, refreshCustomers, refreshProducts, refreshTransactions]);
  const seedDemo = useCallback(async () => {
    try { showToast((await api.post('/api/seed', {})).data.message); await refreshAll(); }
    catch (err) { showToast(err.response?.data?.message || 'Could not add sample data.', 'error'); }
  }, [refreshAll, showToast]);
  useEffect(() => { refreshAll(); }, [refreshAll]);
  return <ShopContext.Provider value={{ dashboard, customers, customersLoading, products, transactions, loading, error: Object.values(errors).filter(Boolean).join(' '), speechLang, setSpeechLang, isVoiceModalOpen, setIsVoiceModalOpen, toast, showToast, refreshAll, refreshDashboard, refreshCustomers, refreshProducts, refreshTransactions, seedDemo }}>{children}</ShopContext.Provider>;
}
export function useShop() {
  const context = useContext(ShopContext);
  if (!context) throw new Error('useShop must be used within a ShopProvider');
  return context;
}
