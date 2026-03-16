import React from 'react';
import { NavLink } from 'react-router-dom';
import { GitBranch, ClipboardList, Zap } from 'lucide-react';

const NAV_ITEMS = [
  { to: '/workflows', label: 'Workflows',  Icon: GitBranch },
  { to: '/audit',     label: 'Audit Log',  Icon: ClipboardList },
];

export default function Sidebar() {
  return (
    <aside className="fixed left-0 top-0 h-full w-64 bg-[#1E1B4B] flex flex-col z-50">
      {/* ── logo ──────────────────────────────────────────────────────── */}
      <div className="px-6 py-6 flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center">
          <Zap className="w-5 h-5 text-white" />
        </div>
        <span className="text-white text-lg font-bold tracking-tight">
          Workflow Engine
        </span>
      </div>

      {/* ── nav links ─────────────────────────────────────────────────── */}
      <nav className="flex-1 px-3 mt-2 space-y-1">
        {NAV_ITEMS.map(({ to, label, Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-indigo-600 text-white'
                  : 'text-indigo-200 hover:bg-indigo-800 hover:text-white'
              }`
            }
          >
            <Icon className="w-5 h-5" />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* ── footer ────────────────────────────────────────────────────── */}
      <div className="px-6 py-4 border-t border-indigo-800">
        <p className="text-indigo-400 text-xs">Halleyx Challenge 2026</p>
        <p className="text-indigo-500 text-xs mt-0.5">v1.0.0</p>
      </div>
    </aside>
  );
}
