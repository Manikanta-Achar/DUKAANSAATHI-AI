import { useShop } from '../context/ShopContext.jsx';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

export default function Toast() {
  const { toast } = useShop();

  if (!toast.visible) return null;

  const isSuccess = toast.type === 'success';
  const isError = toast.type === 'error';

  return (
    <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 bg-white border rounded-xl shadow-lg border-slate-200 transition-all duration-300">
      {isSuccess && <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />}
      {isError && <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />}
      {!isSuccess && !isError && <Info className="w-5 h-5 text-blue-600 shrink-0" />}
      <span className="text-sm font-medium text-slate-800">{toast.message}</span>
    </div>
  );
}
