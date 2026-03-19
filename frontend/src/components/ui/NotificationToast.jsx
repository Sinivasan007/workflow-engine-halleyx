import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useNotifications } from '../../context/NotificationContext';

const CHANNEL_ICONS = {
  email: '📧',
  slack: '💬',
  sms: '📱',
};

const getIcon = (channel) => CHANNEL_ICONS[(channel || '').toLowerCase()] || '🔔';

function ToastItem({ toast, onRemove }) {
  const [progress, setProgress] = useState(100);

  useEffect(() => {
    const start = Date.now();
    const duration = 4000;
    const interval = setInterval(() => {
      const elapsed = Date.now() - start;
      const remaining = Math.max(0, 100 - (elapsed / duration) * 100);
      setProgress(remaining);
      if (remaining === 0) clearInterval(interval);
    }, 50);
    return () => clearInterval(interval);
  }, []);

  const previewText = toast.template
    ? toast.template.substring(0, 60) + (toast.template.length > 60 ? '...' : '')
    : null;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 100, scale: 0.9 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 100, scale: 0.9 }}
      transition={{ type: 'spring', damping: 20 }}
      className="relative w-80 overflow-hidden"
      style={{
        background: '#FFFFFF',
        border: '1px solid #E5E7EB',
        borderRadius: '1rem',
        padding: '1rem',
        boxShadow: '0 10px 40px rgba(0,0,0,0.1)',
      }}
    >
      {/* Top row */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xl">{getIcon(toast.channel)}</span>
          <span className="text-[#111827] font-semibold text-sm">
            {(toast.channel || 'Email').charAt(0).toUpperCase() + (toast.channel || 'email').slice(1)} Sent Successfully!
          </span>
        </div>
        <button
          onClick={() => onRemove(toast.id)}
          className="text-[#6B7280] hover:text-[#111827] transition-colors text-lg leading-none"
        >
          ✕
        </button>
      </div>

      {/* Step name */}
      {toast.step_name && (
        <p className="text-xs text-violet-600 uppercase tracking-wider mb-2 font-semibold">
          STEP: {toast.step_name}
        </p>
      )}

      {/* Divider */}
      <div className="h-px bg-[#E5E7EB] mb-3" />

      {/* Info rows */}
      <div className="space-y-1.5">
        {toast.to && (
          <div className="flex items-center gap-2">
            <span className="text-[#6B7280] text-xs">📧</span>
            <span className="text-[#6B7280] text-xs">To:</span>
            <span className="text-[#374151] text-xs flex-1 truncate">{toast.to}</span>
          </div>
        )}
        <div className="flex items-center gap-2">
          <span className="text-[#6B7280] text-xs">📡</span>
          <span className="text-[#6B7280] text-xs">Channel:</span>
          <span className="text-[#374151] text-xs capitalize">{toast.channel || 'Email'}</span>
        </div>
      </div>

      {/* Template preview */}
      {previewText && (
        <div className="mt-3">
          <div className="flex items-center gap-1 mb-1">
            <span className="text-[#6B7280] text-xs">💬</span>
            <span className="text-[#6B7280] text-xs">Message:</span>
          </div>
          <div
            className="rounded-lg p-2 text-[#374151] text-xs italic"
            style={{ background: '#F8F7FF' }}
          >
            "{previewText}"
          </div>
        </div>
      )}

      {/* Delivery status + timestamp */}
      <div className="flex items-center justify-between mt-3">
        <span className="text-emerald-600 text-xs font-medium">✅ Delivered Successfully</span>
        <span className="text-[#6B7280] text-xs">Just now</span>
      </div>

      {/* Progress bar */}
      <div
        className="absolute bottom-0 left-0 h-0.5 bg-violet-500 transition-all"
        style={{ width: `${progress}%`, transitionDuration: '50ms' }}
      />
    </motion.div>
  );
}

export default function NotificationToast() {
  const { toasts, removeToast } = useNotifications();

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-3 pointer-events-none">
      <AnimatePresence mode="popLayout">
        {toasts.map(toast => (
          <div key={toast.id} className="pointer-events-auto">
            <ToastItem toast={toast} onRemove={removeToast} />
          </div>
        ))}
      </AnimatePresence>
    </div>
  );
}
