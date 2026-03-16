import React from 'react';

/* ── colour map ────────────────────────────────────────────────────────── */
const BADGE_MAP = {
  /* execution / workflow statuses */
  active:       { bg: 'bg-emerald-100', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  completed:    { bg: 'bg-emerald-100', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  in_progress:  { bg: 'bg-blue-100',    text: 'text-blue-700',    dot: 'bg-blue-500', pulse: true },
  failed:       { bg: 'bg-red-100',      text: 'text-red-700',      dot: 'bg-red-500' },
  canceled:     { bg: 'bg-gray-100',     text: 'text-gray-600',     dot: 'bg-gray-400' },
  cancelled:    { bg: 'bg-gray-100',     text: 'text-gray-600',     dot: 'bg-gray-400' },
  pending:      { bg: 'bg-amber-100',    text: 'text-amber-700',    dot: 'bg-amber-500' },
  inactive:     { bg: 'bg-gray-100',     text: 'text-gray-600',     dot: 'bg-gray-400' },

  /* step types */
  approval:     { bg: 'bg-blue-100',     text: 'text-blue-700',     dot: 'bg-blue-500' },
  notification: { bg: 'bg-purple-100',   text: 'text-purple-700',   dot: 'bg-purple-500' },
  task:         { bg: 'bg-orange-100',   text: 'text-orange-700',   dot: 'bg-orange-500' },
};

const FALLBACK = { bg: 'bg-gray-100', text: 'text-gray-600', dot: 'bg-gray-400' };

/* ── sizes ─────────────────────────────────────────────────────────────── */
const SIZE_MAP = {
  sm: 'text-xs px-2 py-0.5',
  md: 'text-xs px-2.5 py-1',
};

/* ── component ─────────────────────────────────────────────────────────── */
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
        ${cfg.bg} ${cfg.text} ${sizeClass}
      `}
    >
      {/* dot — animated pulse for in_progress */}
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
