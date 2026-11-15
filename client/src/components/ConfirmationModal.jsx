import { AlertTriangle, X } from 'lucide-react';
import { useRef, useState } from 'react';

export default function ConfirmationModal({
  isOpen,
  title = 'Confirm Action',
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  isDestructive = false,
  onConfirm,
  onCancel,
  children,
}) {
  const inFlight = useRef(false);
  const [pending, setPending] = useState(false);
  const confirm = async (event) => {
    if (inFlight.current) return;
    inFlight.current = true;
    setPending(true);
    try { await onConfirm(event); }
    finally { inFlight.current = false; setPending(false); }
  };
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between p-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            {isDestructive && (
              <div className="p-1.5 rounded-lg bg-rose-100 text-rose-600">
                <AlertTriangle className="w-4 h-4" />
              </div>
            )}
            <h3 className="font-bold text-slate-900 text-base">{title}</h3>
          </div>
          <button
            disabled={pending}
            onClick={onCancel}
            className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 text-sm text-slate-600 space-y-3">
          {message && <p>{message}</p>}
          {children}
        </div>

        <div className="flex items-center justify-end gap-2.5 p-4 bg-slate-50 border-t border-slate-100">
          <button
            disabled={pending}
            onClick={onCancel}
            className="px-4 py-2 text-xs sm:text-sm font-semibold text-slate-600 hover:text-slate-900 bg-white border border-slate-200 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
          >
            {cancelLabel}
          </button>
          <button
            disabled={pending}
            onClick={confirm}
            className={`px-4 py-2 text-xs sm:text-sm font-semibold text-white rounded-xl shadow-xs transition-colors cursor-pointer ${
              isDestructive
                ? 'bg-rose-600 hover:bg-rose-700'
                : 'bg-emerald-600 hover:bg-emerald-700'
            }`}
          >
            {pending ? 'Saving...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
