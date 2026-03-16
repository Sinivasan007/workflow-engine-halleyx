import React, { useEffect } from 'react';
import { X } from 'lucide-react';

/* ── size presets ───────────────────────────────────────────────────────── */
const SIZE_MAP = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-3xl',
};

export default function Modal({ isOpen, onClose, title, children, size = 'md' }) {
  /* close on Escape */
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  /* lock body scroll while open */
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  if (!isOpen) return null;

  const widthClass = SIZE_MAP[size] || SIZE_MAP.md;

  return (
    <div className="fixed inset-0 z-[9000] flex items-center justify-center">
      {/* backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-fadeIn"
        onClick={onClose}
      />

      {/* card */}
      <div
        className={`
          relative w-full ${widthClass} mx-4
          bg-white rounded-2xl shadow-2xl
          animate-modalIn
          max-h-[90vh] flex flex-col
        `}
      >
        {/* header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* body (scrollable) */}
        <div className="px-6 py-4 overflow-y-auto flex-1">
          {children}
        </div>
      </div>

      {/* keyframe styles */}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes modalIn {
          from { opacity: 0; transform: scale(0.95) translateY(10px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
        .animate-fadeIn  { animation: fadeIn  0.2s ease-out; }
        .animate-modalIn { animation: modalIn 0.25s ease-out; }
      `}</style>
    </div>
  );
}
