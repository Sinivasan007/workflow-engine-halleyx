import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { GitBranch, ClipboardList, Zap } from 'lucide-react';

const NAV_ITEMS = [
  { to: '/workflows', label: 'Workflows', Icon: GitBranch },
  { to: '/audit',     label: 'Audit Log', Icon: ClipboardList },
];

export default function Sidebar() {
  const location = useLocation();

  return (
    <aside className="fixed left-0 top-0 h-full w-64 bg-[#0A0A14] border-r border-[#2D2D5E] flex flex-col z-50">

      {/* ── logo ───────────────────────────────────── */}
      <div className="px-6 py-6 flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center shadow-[0_0_20px_rgba(99,102,241,0.3)]">
          <Zap className="w-5 h-5 text-white" />
        </div>
        <div>
          <span className="text-white text-lg font-bold tracking-tight block leading-tight">
            Workflow Engine
          </span>
          <span className="text-[#64748B] text-xs">Halleyx 2026</span>
        </div>
      </div>

      {/* ── nav links ──────────────────────────────── */}
      <nav className="flex-1 px-3 mt-2 space-y-1">
        {NAV_ITEMS.map(({ to, label, Icon }) => {
          const isActive = location.pathname.startsWith(to);
          return (
            <NavLink
              key={to}
              to={to}
              className={`
                flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium
                transition-all duration-200 relative
                ${isActive
                  ? 'bg-indigo-600/20 text-indigo-400 font-medium'
                  : 'text-[#64748B] hover:text-white hover:bg-[#1A1A35]'
                }
              `}
            >
              {isActive && (
                <motion.div
                  layoutId="sidebar-active"
                  className="absolute left-0 top-0 bottom-0 w-0.5 bg-indigo-500 rounded-full"
                  transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                />
              )}
              <Icon className="w-5 h-5" />
              {label}
            </NavLink>
          );
        })}
      </nav>

      {/* ── bottom section ─────────────────────────── */}
      <div className="px-6 py-4 border-t border-[#2D2D5E]">
        <div className="flex items-center gap-2 mb-2">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75 animate-ping" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-400" />
          </span>
          <span className="text-[#94A3B8] text-xs">API Connected</span>
        </div>
        <p className="text-[#64748B] text-xs mb-3">localhost:5000</p>
        <div className="border-t border-[#2D2D5E] pt-3">
          <p className="text-[#94A3B8] text-xs">Halleyx Challenge 2026</p>
          <p className="text-[#64748B] text-xs mt-0.5">v1.0.0</p>
        </div>
      </div>
    </aside>
  );
}
