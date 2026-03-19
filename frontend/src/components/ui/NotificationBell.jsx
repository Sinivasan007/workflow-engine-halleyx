import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, Info, CheckCircle, AlertTriangle, XCircle } from 'lucide-react';
import { useNotifications } from '../../context/NotificationContext';

const TYPE_CONFIG = {
  info:    { Icon: Info,          bg: 'rgba(59,130,246,0.15)',  text: '#60a5fa', border: 'rgba(59,130,246,0.3)'  },
  success: { Icon: CheckCircle,   bg: 'rgba(34,197,94,0.15)',   text: '#4ade80', border: 'rgba(34,197,94,0.3)'   },
  warning: { Icon: AlertTriangle,  bg: 'rgba(245,158,11,0.15)',  text: '#fbbf24', border: 'rgba(245,158,11,0.3)'  },
  error:   { Icon: XCircle,       bg: 'rgba(239,68,68,0.15)',   text: '#f87171', border: 'rgba(239,68,68,0.3)'   },
};

const getConfig = (type) => TYPE_CONFIG[type] || TYPE_CONFIG.info;

const fmtTime = (ts) => {
  if (!ts) return 'Just now';
  return new Date(ts).toLocaleString([], {
    month: 'numeric', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit'
  });
};

export default function NotificationBell() {
  const { bellNotifications, markAllRead, clearAll } = useNotifications();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  const unreadCount = bellNotifications.filter(n => !n.read).length;

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      {/* Bell Button */}
      <button onClick={() => setOpen(p => !p)}
        className="relative p-2 rounded-xl text-[#94A3B8] hover:text-white hover:bg-[#1E1E35] transition-all"
        aria-label="Notifications">
        <Bell className="w-5 h-5" />
        <AnimatePresence>
          {unreadCount > 0 && (
            <motion.span key={unreadCount} initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}
              transition={{ type: 'spring', damping: 14 }}
              className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full text-white text-xs font-bold flex items-center justify-center">
              {unreadCount > 9 ? '9+' : unreadCount}
            </motion.span>
          )}
        </AnimatePresence>
      </button>

      {/* Dropdown */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ type: 'spring', damping: 20, stiffness: 280 }}
            className="absolute top-12 right-0 z-50 overflow-hidden"
            style={{
              width: '24rem', maxHeight: '520px',
              background: '#FFFFFF', border: '1px solid #E5E7EB',
              borderRadius: '1rem', boxShadow: '0 20px 60px rgba(0,0,0,0.12)',
            }}>

            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-[#E5E7EB]" style={{ background: '#F8F7FF' }}>
              <div className="flex items-center gap-2">
                <span className="text-[#111827] font-semibold text-sm">Notifications</span>
                {unreadCount > 0 && (
                  <span className="bg-violet-100 text-violet-600 border border-violet-200 text-xs font-bold px-2 py-0.5 rounded-full">{unreadCount}</span>
                )}
              </div>
              <div className="flex items-center gap-3">
                {unreadCount > 0 && (
                  <button onClick={(e) => { e.stopPropagation(); markAllRead(); }}
                    className="text-violet-600 hover:text-violet-500 text-xs transition-colors">Mark all read</button>
                )}
                {bellNotifications.length > 0 && (
                  <button onClick={(e) => { e.stopPropagation(); clearAll(); }}
                    className="text-[#6B7280] hover:text-red-500 text-xs transition-colors">Clear all</button>
                )}
              </div>
            </div>

            {/* List */}
            <div style={{ maxHeight: '440px', overflowY: 'auto' }}>
              {bellNotifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
                  <span className="text-5xl mb-4 opacity-40">🔔</span>
                  <p className="text-[#6B7280] text-sm font-medium">No notifications yet</p>
                  <p className="text-[#9CA3AF] text-xs mt-1">Notifications appear during workflow execution</p>
                </div>
              ) : (
                <AnimatePresence initial={false}>
                  {bellNotifications.map((notif, idx) => {
                    const cfg = getConfig(notif.type);
                    const TypeIcon = cfg.Icon;
                    return (
                      <motion.div key={notif.id}
                        initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.03 }}
                        className="px-4 py-3 border-b transition-colors cursor-default"
                        style={{
                          borderBottomColor: '#F3F4F6',
                          borderLeft: `2px solid ${notif.read ? 'transparent' : '#8B5CF6'}`,
                          background: notif.read ? 'transparent' : 'rgba(139,92,246,0.1)',
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = '#F8F7FF'}
                        onMouseLeave={e => e.currentTarget.style.background = notif.read ? 'transparent' : 'rgba(139,92,246,0.1)'}>
                        <div className="flex items-start gap-3">
                          <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
                            style={{ background: cfg.bg }}>
                            <TypeIcon className="w-4 h-4" style={{ color: cfg.text }} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <p className="text-[#111827] text-sm font-medium truncate">{notif.title || 'Notification'}</p>
                              <span className="text-[#6B7280] text-[10px] whitespace-nowrap ml-2">{fmtTime(notif.time)}</span>
                            </div>
                            <p className="text-[#6B7280] text-xs mt-0.5 leading-relaxed">{notif.message || ''}</p>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
