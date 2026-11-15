import { Routes, Route } from 'react-router-dom';
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
  const { isVoiceModalOpen, setIsVoiceModalOpen } = useShop();

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-900">
      <Navbar />

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

export default function App() {
  return (
    <ShopProvider>
      <AppContent />
    </ShopProvider>
  );
}
