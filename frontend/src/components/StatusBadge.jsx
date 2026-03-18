import React from 'react';

const BADGE_MAP = {
  completed:    { bg: 'bg-green-500/10',   text: 'text-green-400',   border: 'border-green-500/30',  dot: 'bg-green-400' },
  failed:       { bg: 'bg-red-500/10',     text: 'text-red-400',     border: 'border-red-500/30',    dot: 'bg-red-400' },
  in_progress:  { bg: 'bg-blue-500/10',    text: 'text-blue-400',    border: 'border-blue-500/30',   dot: 'bg-blue-400', pulse: true },
  canceled:     { bg: 'bg-gray-500/10',    text: 'text-gray-400',    border: 'border-gray-500/30',   dot: 'bg-gray-400' },
  cancelled:    { bg: 'bg-gray-500/10',    text: 'text-gray-400',    border: 'border-gray-500/30',   dot: 'bg-gray-400' },
  pending:      { bg: 'bg-yellow-500/10',  text: 'text-yellow-400',  border: 'border-yellow-500/30', dot: 'bg-yellow-400' },
  active:       { bg: 'bg-green-500/10',   text: 'text-green-400',   border: 'border-green-500/30',  dot: 'bg-green-400' },
  inactive:     { bg: 'bg-gray-500/10',    text: 'text-gray-400',    border: 'border-gray-500/30',   dot: 'bg-gray-400' },

  /* step types */
  approval:     { bg: 'bg-blue-500/10',    text: 'text-blue-400',    border: 'border-blue-500/30',   dot: 'bg-blue-400' },
  notification: { bg: 'bg-purple-500/10',  text: 'text-purple-400',  border: 'border-purple-500/30', dot: 'bg-purple-400' },
  task:         { bg: 'bg-orange-500/10',  text: 'text-orange-400',  border: 'border-orange-500/30', dot: 'bg-orange-400' },
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
