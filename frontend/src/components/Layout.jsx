import React from 'react';
import { useLocation, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ChevronRight } from 'lucide-react';
import Sidebar from './Sidebar';

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
  return (
    <div className="flex min-h-screen bg-[#0F0F1A]">

      {/* Fixed Sidebar */}
      <aside className="fixed top-0 left-0 h-full w-64 z-20">
        <Sidebar />
      </aside>

      {/* Main Content */}
      <div className="flex flex-col flex-1 ml-64">

        {/* Fixed Navbar */}
        <header
          className="fixed top-0 right-0 left-64 bg-[#0A0A14]/80 backdrop-blur-xl border-b border-[#2D2D5E] h-16 z-10 flex items-center justify-between px-8"
        >
          {/* Left side */}
          <div className="flex items-center gap-4">
            <Breadcrumbs />
          </div>

          {/* Right side - Removed as per user request */}
          <div className="flex items-center gap-3">
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
