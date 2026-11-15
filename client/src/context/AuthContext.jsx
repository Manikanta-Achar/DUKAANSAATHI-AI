import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import api, { setCsrfToken } from '../api/api.js';

const AuthContext = createContext(null);
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const acceptSession = (data) => { setCsrfToken(data.csrfToken); setUser(data.user); };
  const restoreSession = useCallback(async () => {
    setLoading(true);
    setError('');
    try { acceptSession((await api.get('/api/auth/me')).data.data); }
    catch (err) {
      if (err.response?.status === 401) { setUser(null); setCsrfToken(); }
      else setError(err.response?.data?.message || 'Could not restore your session. Check the server connection and try again.');
    } finally { setLoading(false); }
  }, []);
  useEffect(() => {
    restoreSession();
    const expired = () => { setUser(null); setCsrfToken(); };
    window.addEventListener('session-expired', expired);
    return () => window.removeEventListener('session-expired', expired);
  }, [restoreSession]);
  const authenticate = async (route, fields) => {
    setBusy(true);
    try { acceptSession((await api.post(`/api/auth/${route}`, fields)).data.data); setError(''); }
    finally { setBusy(false); }
  };
  const logout = async () => {
    setBusy(true);
    try { await api.post('/api/auth/logout', {}); setCsrfToken(); setUser(null); }
    finally { setBusy(false); }
  };
  return <AuthContext.Provider value={{ user, loading, error, busy, restoreSession, login: (fields) => authenticate('login', fields), register: (fields) => authenticate('register', fields), logout }}>{children}</AuthContext.Provider>;
}
export const useAuth = () => useContext(AuthContext);
