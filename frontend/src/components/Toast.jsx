import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, CheckCircle, AlertCircle, AlertTriangle, Info } from 'lucide-react';

/* ── colour / icon map ─────────────────────────────────────────────────── */
const TOAST_CONFIG = {
  success: {
    bg: 'bg-green-500/10 border-green-500/30',
    icon: 'text-green-400',
    Icon: CheckCircle,
  },
  error: {
    bg: 'bg-red-500/10 border-red-500/30',
    icon: 'text-red-400',
    Icon: AlertCircle,
  },
  warning: {
    bg: 'bg-amber-500/10 border-amber-500/30',
    icon: 'text-amber-400',
    Icon: AlertTriangle,
  },
  info: {
    bg: 'bg-indigo-500/10 border-indigo-500/30',
    icon: 'text-indigo-400',
    Icon: Info,
  },
};

/* ── single toast ──────────────────────────────────────────────────────── */
function ToastItem({ toast, onClose }) {
  const cfg = TOAST_CONFIG[toast.type] || TOAST_CONFIG.info;
  const IconComp = cfg.Icon;

  useEffect(() => {
    const t = setTimeout(() => onClose(toast.id), 3000);
    return () => clearTimeout(t);
  }, [toast.id, onClose]);

  return (
    <motion.div
      initial={{ x: 100, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 100, opacity: 0 }}
      transition={{ type: 'spring', damping: 25, stiffness: 300 }}
      className={`
        flex items-start gap-3 w-80 border rounded-xl p-4
        shadow-[0_4px_24px_rgba(0,0,0,0.4)] backdrop-blur-sm
        ${cfg.bg}
      `}
    >
      <IconComp className={`w-5 h-5 mt-0.5 flex-shrink-0 ${cfg.icon}`} />
      <p className="flex-1 text-sm font-medium text-white leading-snug">
        {toast.message}
      </p>
      <button
        onClick={() => onClose(toast.id)}
        className="flex-shrink-0 text-[#64748B] hover:text-white transition"
      >
        <X className="w-4 h-4" />
      </button>
    </motion.div>
  );
}

/* ── container ─────────────────────────────────────────────────────────── */
function ToastContainer({ toasts, removeToast }) {
  return (
    <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-3">
      <AnimatePresence>
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onClose={removeToast} />
        ))}
      </AnimatePresence>
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
    </ToastContext.Provider>
  );
}

/* ── hook ───────────────────────────────────────────────────────────────── */
export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}
