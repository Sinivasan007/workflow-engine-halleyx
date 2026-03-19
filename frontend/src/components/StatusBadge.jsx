import React from 'react';

const BADGE_MAP = {
  completed:    { bg: 'bg-emerald-50',   text: 'text-emerald-700',   border: 'border-emerald-200',  dot: 'bg-emerald-500' },
  failed:       { bg: 'bg-red-50',       text: 'text-red-700',       border: 'border-red-200',      dot: 'bg-red-500' },
  in_progress:  { bg: 'bg-blue-50',      text: 'text-blue-700',      border: 'border-blue-200',     dot: 'bg-blue-500', pulse: true },
  canceled:     { bg: 'bg-gray-100',     text: 'text-gray-600',      border: 'border-gray-200',     dot: 'bg-gray-500' },
  cancelled:    { bg: 'bg-gray-100',     text: 'text-gray-600',      border: 'border-gray-200',     dot: 'bg-gray-500' },
  pending:      { bg: 'bg-gray-100',     text: 'text-gray-600',      border: 'border-gray-200',     dot: 'bg-gray-500' },
  active:       { bg: 'bg-emerald-50',   text: 'text-emerald-700',   border: 'border-emerald-200',  dot: 'bg-emerald-500' },
  inactive:     { bg: 'bg-gray-100',     text: 'text-gray-600',      border: 'border-gray-200',     dot: 'bg-gray-500' },

  /* step types */
  approval:     { bg: 'bg-blue-100',     text: 'text-blue-700',      border: 'border-blue-200',     dot: 'bg-blue-500' },
  notification: { bg: 'bg-purple-100',   text: 'text-purple-700',    border: 'border-purple-200',   dot: 'bg-purple-500' },
  task:         { bg: 'bg-orange-100',   text: 'text-orange-700',    border: 'border-orange-200',   dot: 'bg-orange-500' },
};

const FALLBACK = { bg: 'bg-gray-500/10', text: 'text-gray-400', border: 'border-gray-500/30', dot: 'bg-gray-400' };

const SIZE_MAP = {
  sm: 'text-xs px-2 py-0.5',
  md: 'text-xs px-2.5 py-1',
};

export default function StatusBadge({ status, size = 'md' }) {
  if (!status) return null;

  const key = status.toLowerCase().replace(/-/g, '_');
  const cfg = BADGE_MAP[key] || FALLBACK;
  const sizeClass = SIZE_MAP[size] || SIZE_MAP.md;

  const label = status
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <span
      className={`
        inline-flex items-center gap-1.5 font-semibold rounded-full whitespace-nowrap
        border ${cfg.bg} ${cfg.text} ${cfg.border} ${sizeClass}
      `}
    >
      <span className="relative flex h-2 w-2">
        {cfg.pulse && (
          <span
            className={`absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping ${cfg.dot}`}
          />
        )}
        <span className={`relative inline-flex rounded-full h-2 w-2 ${cfg.dot}`} />
      </span>
      {label}
    </span>
  );
}
