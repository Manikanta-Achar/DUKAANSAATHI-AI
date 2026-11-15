import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../api/api.js';

export const ShopContext = createContext(null);

export function ShopProvider({ children }) {
  const [dashboard, setDashboard] = useState({
    totalSales: 0,
    outstandingUdhaar: 0,
    totalCustomers: 0,
    lowStockCount: 0,
    recentTransactions: [],
    lowStockItems: [],
    dailySales: [],
  });

  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Voice Language: 'hi-IN' (Hindi), 'kn-IN' (Kannada), 'en-IN' (English)
  const [speechLang, setSpeechLang] = useState('hi-IN');
  const [isVoiceModalOpen, setIsVoiceModalOpen] = useState(false);

  // Toast notification state
  const [toast, setToast] = useState({ message: '', type: 'success', visible: false });

  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type, visible: true });
    setTimeout(() => {
      setToast((prev) => ({ ...prev, visible: false }));
    }, 4000);
  }, []);

  const refreshDashboard = useCallback(async () => {
    try {
      const res = await api.get('/api/dashboard');
      if (res.data?.success) {
        setDashboard(res.data.data);
      }
    } catch (err) {
      console.warn('Dashboard fetch issue:', err.message);
    }
  }, []);

  const refreshCustomers = useCallback(async (search = '', status = 'active') => {
    try {
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (status) params.append('status', status);
      const res = await api.get(`/api/udhaar/customers?${params.toString()}`, {
        headers: { 'Cache-Control': 'no-cache' },
      });
      if (res.data?.success && Array.isArray(res.data.data)) {
        setCustomers(res.data.data);
        return true;
      }
      return false;
    } catch (err) {
      console.warn('Customers fetch issue:', err.message);
      return false;
    }
  }, []);

  const refreshProducts = useCallback(async (search = '') => {
    try {
      const res = await api.get(`/api/inventory${search ? `?search=${encodeURIComponent(search)}` : ''}`);
      if (res.data?.success) {
        setProducts(res.data.data);
      }
    } catch (err) {
      console.warn('Products fetch issue:', err.message);
    }
  }, []);

  const refreshTransactions = useCallback(async (filters = {}) => {
    try {
      const params = new URLSearchParams();
      if (filters.type) params.append('type', filters.type);
      if (filters.search) params.append('search', filters.search);
      if (filters.limit) params.append('limit', filters.limit);

      const res = await api.get(`/api/transactions?${params.toString()}`);
      if (res.data?.success) {
        setTransactions(res.data.data);
      }
    } catch (err) {
      console.warn('Transactions fetch issue:', err.message);
    }
  }, []);

  const refreshAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      await Promise.all([
        refreshDashboard(),
        refreshCustomers(),
        refreshProducts(),
        refreshTransactions(),
      ]);
    } catch (err) {
      setError('Could not connect to DukaanSaathi server. Please ensure the backend is running.');
    } finally {
      setLoading(false);
    }
  }, [refreshDashboard, refreshCustomers, refreshProducts, refreshTransactions]);

  const seedDemo = useCallback(
    async (force = false) => {
      try {
        const res = await api.post('/api/seed', { force });
        showToast(res.data?.message || 'Demo data loaded successfully!', 'success');
        await refreshAll();
      } catch (err) {
        showToast('Seed failed: ' + (err.response?.data?.message || err.message), 'error');
      }
    },
    [refreshAll, showToast]
  );

  useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  const value = {
    dashboard,
    customers,
    products,
    transactions,
    loading,
    error,
    speechLang,
    setSpeechLang,
    isVoiceModalOpen,
    setIsVoiceModalOpen,
    toast,
    showToast,
    refreshAll,
    refreshDashboard,
    refreshCustomers,
    refreshProducts,
    refreshTransactions,
    seedDemo,
  };

  return <ShopContext.Provider value={value}>{children}</ShopContext.Provider>;
}

export function useShop() {
  const context = useContext(ShopContext);
  if (!context) {
    throw new Error('useShop must be used within a ShopProvider');
  }
  return context;
}
