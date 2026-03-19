import React from 'react';
import { useLocation, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ChevronRight, LogOut } from 'lucide-react';
import Sidebar from './Sidebar';
import NotificationBell from './ui/NotificationBell';
import { useAuth } from '../context/AuthContext';

/* ── breadcrumb builder ────────────────────────────────────────────────── */
function Breadcrumbs() {
  const location = useLocation();
  const parts = location.pathname.split('/').filter(Boolean);

  const crumbs = [{ label: 'Home', path: '/' }];
  let currentPath = '';
  parts.forEach((part) => {
    currentPath += `/${part}`;
    let label = part.charAt(0).toUpperCase() + part.slice(1);
    if (part === 'new') label = 'Create';
    if (part === 'edit') label = 'Edit';
    if (part === 'execute') label = 'Execute';
    if (part === 'rules') label = 'Rules';
    if (part === 'audit') label = 'Audit Log';
    // skip UUID-like segments in label
    if (/^[a-f0-9-]{8,}$/i.test(part)) label = part.substring(0, 8) + '…';
    crumbs.push({ label, path: currentPath });
  });

  return (
    <div className="flex items-center gap-1 text-sm">
      {crumbs.map((crumb, i) => (
        <React.Fragment key={i}>
          {i > 0 && <ChevronRight className="w-3.5 h-3.5 text-[#64748B]" />}
          {i < crumbs.length - 1 ? (
            <Link to={crumb.path} className="text-[#64748B] hover:text-white transition">
              {crumb.label}
            </Link>
          ) : (
            <span className="text-white font-medium">{crumb.label}</span>
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

export default function Layout({ children, title }) {
  const { user, logout } = useAuth();
  return (
    <div className="flex min-h-screen bg-[#F8F7FF]">

      {/* Fixed Sidebar */}
      <aside className="fixed top-0 left-0 h-full w-64 z-20">
        <Sidebar />
      </aside>

      {/* Main Content */}
      <div className="flex flex-col flex-1 ml-64">

        {/* Fixed Navbar */}
        <header
          className="fixed top-0 right-0 left-64 bg-[rgba(8,8,18,0.8)] backdrop-blur-xl border-b border-[#1E1E35] h-16 z-10 flex items-center justify-between px-8"
        >
          {/* Left side */}
          <div className="flex items-center gap-4">
            <Breadcrumbs />
          </div>

          {/* Right side — Notification Bell & User Avatar */}
          <div className="flex items-center gap-4">
            <NotificationBell />
            <div className="h-6 w-[1px] bg-[#1E1E35] mx-1" />
            
            <div className="relative group pl-1">
              <button className="flex items-center gap-3 focus:outline-none">
                <div className="hidden md:block text-right">
                  <p className="text-xs font-black text-white leading-tight group-hover:text-violet-400 transition-colors">{user?.username || 'User'}</p>
                  <p className="text-[10px] text-[#64748B] font-bold uppercase tracking-wider">{user?.email?.split('@')[0] || 'email'}</p>
                </div>
                <div className="w-9 h-9 rounded-xl bg-violet-600 flex items-center justify-center text-white font-black text-sm shadow-[0_0_15px_rgba(124,58,237,0.3)] group-hover:shadow-[0_0_20px_rgba(124,58,237,0.5)] transition-all">
                  {user?.username?.charAt(0).toUpperCase() || 'U'}
                </div>
              </button>

              {/* Mini Dropdown */}
              <div className="absolute top-full right-0 mt-2 w-48 bg-[#FFFFFF] border border-[#E5E7EB] rounded-2xl shadow-card opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 p-2">
                <div className="p-3 border-b border-[#E5E7EB] mb-1">
                  <p className="text-[10px] font-black text-[#6B7280] uppercase tracking-widest">{user?.username || 'User'}</p>
                </div>
                <button 
                  onClick={() => logout()}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-500 font-bold hover:bg-red-50 rounded-xl transition"
                >
                  <LogOut className="w-4 h-4" /> Sign Out
                </button>
              </div>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <motion.main
          className="flex-1 overflow-x-hidden overflow-y-auto pt-20 px-8 pb-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          {children}
        </motion.main>

      </div>
    </div>
  );
}
