import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import Login from './pages/Login.jsx';
import Register from './pages/Register.jsx';
import { ShopProvider, useShop } from './context/ShopContext.jsx';
import Navbar from './components/Navbar.jsx';
import Sidebar from './components/Sidebar.jsx';
import Toast from './components/Toast.jsx';
import VoiceAssistant from './components/VoiceAssistant.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Udhaar from './pages/Udhaar.jsx';
import Inventory from './pages/Inventory.jsx';
import History from './pages/History.jsx';

function AppContent() {
  const { isVoiceModalOpen, setIsVoiceModalOpen, error } = useShop();

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-900">
      <Navbar />
      {error && (
        <div role="alert" className="bg-rose-50 px-4 py-2 text-center text-sm text-rose-800">
          {error}
        </div>
      )}

      <div className="flex flex-col md:flex-row flex-1">
        <Sidebar />
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/udhaar" element={<Udhaar />} />
            <Route path="/inventory" element={<Inventory />} />
            <Route path="/history" element={<History />} />
          </Routes>
        </main>
      </div>

      <Toast />

      {/* Floating Global Voice Assistant Modal (when opened from Navbar) */}
      {isVoiceModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="w-full max-w-xl">
            <VoiceAssistant isModal={true} onClose={() => setIsVoiceModalOpen(false)} />
          </div>
        </div>
      )}
    </div>
  );
}

function AuthenticatedApp() {
  const { user, loading, error, restoreSession } = useAuth();
  const location = useLocation();
  if (loading) return <div role="status" className="min-h-screen grid place-items-center bg-slate-50 text-emerald-800">Restoring your session...</div>;
  if (error) return <div className="min-h-screen grid place-items-center bg-slate-50 p-6"><div role="alert" className="text-center text-slate-700"><p>{error}</p><button onClick={restoreSession} className="mt-4 px-4 py-2 rounded-xl bg-emerald-700 text-white">Try again</button></div></div>;
  return <Routes>
    <Route path="/login" element={<Login />} />
    <Route path="/register" element={<Register />} />
    <Route path="/*" element={user ? <ShopProvider key={user.id}><AppContent /></ShopProvider> : <Navigate to="/login" state={{ from: location.pathname }} replace />} />
  </Routes>;
}
export default function App() { return <AuthProvider><AuthenticatedApp /></AuthProvider>; }
