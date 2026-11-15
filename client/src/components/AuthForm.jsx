import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { Store, LoaderCircle, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';

export default function AuthForm({ isRegister = false }) {
  const { user, login, register, busy } = useAuth();
  const [error, setError] = useState('');
  const [fields, setFields] = useState({ name: '', shopName: '', email: '', password: '', confirmPassword: '' });
  if (user) return <Navigate to="/" replace />;
  const submit = async (event) => {
    event.preventDefault();
    if (busy) return;
    setError('');
    if (isRegister && (fields.password.length < 10 || !/[A-Z]/.test(fields.password) || !/[a-z]/.test(fields.password) || !/\d/.test(fields.password) || new TextEncoder().encode(fields.password).length > 72)) {
      setError('Use at least 10 characters with uppercase, lowercase, and a number. Maximum 72 UTF-8 bytes.'); return;
    }
    if (isRegister && fields.password !== fields.confirmPassword) { setError('Passwords do not match.'); return; }
    try { await (isRegister ? register : login)({ ...fields, email: fields.email.trim().toLowerCase() }); }
    catch (err) { setError(err.response?.data?.message || 'Could not reach the server. Please try again.'); }
  };
  const input = (key, label, type = 'text', autoComplete = key) => (
    <label className="block text-sm font-semibold text-slate-700" key={key}>
      {label}
      <input name={key} type={type} required autoComplete={autoComplete} maxLength={key === 'email' ? 254 : key.includes('assword') ? 72 : 120}
        value={fields[key]} onChange={(event) => setFields({ ...fields, [key]: event.target.value })}
        className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20" />
    </label>
  );
  return (
    <main className="min-h-screen bg-slate-50 flex items-center justify-center px-4 py-8 font-sans">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-center gap-3 mb-6 text-emerald-900"><div className="p-3 bg-emerald-800 text-white rounded-xl"><Store className="h-6 w-6" /></div><span className="text-2xl font-extrabold">DukaanSaathi <span className="text-emerald-600">AI</span></span></div>
        <section className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8">
          <h1 className="text-2xl font-extrabold text-slate-900">{isRegister ? 'Create your shop account' : 'Welcome back'}</h1>
          <p className="mt-2 mb-6 text-sm text-slate-500">{isRegister ? 'Manage your udhaar and stock with your voice.' : 'Log in to manage your shop, customers, and stock.'}</p>
          {error && <p role="alert" className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}
          <form onSubmit={submit} className="space-y-4">
            {isRegister && input('name', 'Full Name', 'text', 'name')}
            {isRegister && input('shopName', 'Shop Name', 'text', 'organization')}
            {input('email', 'Email Address', 'email', 'email')}
            {input('password', 'Password', 'password', isRegister ? 'new-password' : 'current-password')}
            {isRegister && <p className="text-xs text-slate-500">10+ characters, uppercase, lowercase, and a number.</p>}
            {isRegister && input('confirmPassword', 'Confirm Password', 'password', 'new-password')}
            <button type="submit" disabled={busy} className="w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-3 text-sm font-bold text-white hover:bg-emerald-800 disabled:opacity-60 cursor-pointer">{busy && <LoaderCircle className="h-4 w-4 animate-spin" />}{busy ? 'Please wait...' : isRegister ? 'Register & Open Dashboard' : 'Log In'}</button>
          </form>
          <p className="mt-6 text-center text-sm text-slate-500">{isRegister ? 'Already have an account?' : 'New to DukaanSaathi?'}{' '}<Link to={isRegister ? '/login' : '/register'} className="font-semibold text-emerald-700 hover:underline">{isRegister ? 'Log in' : 'Register'}</Link></p>
        </section>
        <p className="mt-5 flex items-center justify-center gap-2 text-xs text-slate-500"><ShieldCheck className="h-4 w-4 text-emerald-600" />Your shop records stay private to your account.</p>
      </div>
    </main>
  );
}
