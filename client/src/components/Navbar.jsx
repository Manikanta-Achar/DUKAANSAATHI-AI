import { useAuth } from '../context/AuthContext.jsx';
import { useShop } from "../context/ShopContext.jsx";
import { Mic, RefreshCw, Store, Globe, Sparkles } from "lucide-react";

export default function Navbar() {
  const { user, logout, busy } = useAuth();
  const { showToast } = useShop();
  const { speechLang, setSpeechLang, setIsVoiceModalOpen, seedDemo, loading } =
    useShop();

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between px-4 py-3 bg-emerald-800 text-white shadow-md sm:px-6">
      {/* Brand & Store Identity */}
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-emerald-700 border border-emerald-600 shadow-inner">
          <Store className="w-5 h-5 text-emerald-200" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-bold tracking-tight text-white sm:text-xl">
              DukaanSaathi{" "}
              <span className="text-emerald-300 font-extrabold">AI</span>
            </h1>
            <span className="hidden px-2 py-0.5 text-xs font-semibold rounded-full bg-emerald-700 text-emerald-100 sm:inline-block">
              Kirana & Chai
            </span>
          </div>
          <p className="text-xs text-emerald-200 max-w-36 sm:max-w-xs truncate">
            {user.name} · {user.shopName}
          </p>
        </div>
      </div>

      {/* Quick Action Controls */}
      <div className="flex items-center gap-2 sm:gap-3">
        <button disabled={busy} onClick={async () => { try { await logout(); } catch (err) { showToast(err.response?.data?.message || 'Logout failed. Please try again.', 'error'); } }} className="px-2 py-1.5 text-xs font-semibold rounded-lg border border-emerald-600 hover:bg-emerald-700">{busy ? 'Please wait...' : 'Logout'}</button>
        {/* Language selector */}
        <div className="flex items-center bg-emerald-900/80 border border-emerald-700 rounded-lg px-2 py-1 text-xs sm:text-sm">
          <Globe className="w-3.5 h-3.5 text-emerald-300 mr-1.5" />
          <select
            value={speechLang}
            onChange={(e) => setSpeechLang(e.target.value)}
            className="bg-transparent text-white font-medium focus:outline-none cursor-pointer"
          >
            <option value="hi-IN" className="text-slate-900">
              हिंदी (Hindi)
            </option>
            <option value="kn-IN" className="text-slate-900">
              ಕನ್ನಡ (Kannada)
            </option>
            <option value="en-IN" className="text-slate-900">
              English (India)
            </option>
          </select>
        </div>

        {import.meta.env.DEV && (
          <button
            onClick={() => seedDemo()}
            disabled={loading}
            title="Add sample data to an empty shop"
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-emerald-700/80 hover:bg-emerald-700 border border-emerald-600 rounded-lg transition-colors cursor-pointer"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`}
            />
            <span className="hidden sm:inline">Add Demo</span>
          </button>
        )}

        {/* Floating Voice Assistant Trigger */}
        <button
          onClick={() => setIsVoiceModalOpen(true)}
          className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs sm:text-sm font-semibold bg-emerald-500 hover:bg-emerald-400 text-emerald-950 rounded-lg shadow-sm hover:shadow transition-all cursor-pointer"
        >
          <Mic className="w-4 h-4 text-emerald-950" />
          <span className="hidden sm:inline">Voice Assistant</span>
        </button>
      </div>
    </header>
  );
}
