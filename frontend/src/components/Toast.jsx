import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { X, CheckCircle, AlertCircle, AlertTriangle, Info } from 'lucide-react';

/* ── colour / icon map ─────────────────────────────────────────────────── */
const TOAST_CONFIG = {
  success: {
    bg: 'bg-emerald-50 border-emerald-200',
    icon: 'text-emerald-500',
    bar: 'bg-emerald-500',
    Icon: CheckCircle,
  },
  error: {
    bg: 'bg-red-50 border-red-200',
    icon: 'text-red-500',
    bar: 'bg-red-500',
    Icon: AlertCircle,
  },
  warning: {
    bg: 'bg-amber-50 border-amber-200',
    icon: 'text-amber-500',
    bar: 'bg-amber-500',
    Icon: AlertTriangle,
  },
  info: {
    bg: 'bg-blue-50 border-blue-200',
    icon: 'text-blue-500',
    bar: 'bg-blue-500',
    Icon: Info,
  },
};

/* ── single toast ──────────────────────────────────────────────────────── */
function ToastItem({ toast, onClose }) {
  const cfg = TOAST_CONFIG[toast.type] || TOAST_CONFIG.info;
  const IconComp = cfg.Icon;
  const [exiting, setExiting] = useState(false);

  /* auto-dismiss */
  useEffect(() => {
    const t = setTimeout(() => {
      setExiting(true);
      setTimeout(() => onClose(toast.id), 300);
    }, 3000);
    return () => clearTimeout(t);
  }, [toast.id, onClose]);

  const handleClose = () => {
    setExiting(true);
    setTimeout(() => onClose(toast.id), 300);
  };

  return (
    <div
      className={`
        flex items-start gap-3 w-80 border rounded-xl p-4 shadow-lg backdrop-blur-sm
        transition-all duration-300 ease-in-out
        ${cfg.bg}
        ${exiting ? 'translate-x-full opacity-0' : 'translate-x-0 opacity-100'}
      `}
      style={{ animation: exiting ? undefined : 'slideInRight 0.3s ease-out' }}
    >
      <IconComp className={`w-5 h-5 mt-0.5 flex-shrink-0 ${cfg.icon}`} />

      <p className="flex-1 text-sm font-medium text-gray-800 leading-snug">
        {toast.message}
      </p>

      <button
        onClick={handleClose}
        className="flex-shrink-0 text-gray-400 hover:text-gray-600 transition"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

/* ── container (portal-style, fixed top-right) ─────────────────────────── */
function ToastContainer({ toasts, removeToast }) {
  return (
    <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-3">
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onClose={removeToast} />
      ))}
    </div>
  );
}

/* ── context + provider ────────────────────────────────────────────────── */
const ToastContext = createContext(null);

let _idCounter = 0;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback((message, type = 'info') => {
    const id = ++_idCounter;
    setToasts((prev) => [...prev, { id, message, type }]);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <ToastContainer toasts={toasts} removeToast={removeToast} />

      {/* slide-in keyframe (injected once) */}
      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(100%); opacity: 0; }
          to   { transform: translateX(0);    opacity: 1; }
        }
      `}</style>
    </ToastContext.Provider>
  );
}

/* ── hook ───────────────────────────────────────────────────────────────── */
export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;          // { showToast }
}
