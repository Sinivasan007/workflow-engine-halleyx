import React, { useState } from 'react';
import { NavLink, useLocation, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ClipboardList, Zap, Settings, 
  LogOut, User as UserIcon, Mail, X, Check, Loader2, LayoutGrid 
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { updateProfile } from '../services/api';
import { useToast } from '../components/Toast';

const NAV_ITEMS = [
  { to: '/workflows', label: 'Workflows', Icon: LayoutGrid },
  { to: '/audit',     label: 'Audit Log', Icon: ClipboardList },
];

export default function Sidebar() {
  const location = useLocation();
  const { user, logout, setUser } = useAuth();
  const { showToast } = useToast();
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

  // Profile Form State
  const [profileData, setProfileData] = useState({
    username: user?.username || '',
    email: user?.email || ''
  });
  const [saving, setSaving] = useState(false);

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await updateProfile(profileData);
      setUser({ ...user, ...profileData });
      showToast('Profile updated successfully', 'success');
      setShowProfileModal(false);
    } catch (err) {
      const msg = err.response?.data?.error || 'Update failed';
      showToast(msg, 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <aside className="fixed left-0 top-0 h-full w-64 bg-[#0D0D1A] border-r border-[#1E1E35] flex flex-col z-50">

        {/* ── logo ───────────────────────────────────── */}
        <Link to="/workflows" className="px-6 py-6 flex items-center gap-3 group">
          <div className="w-9 h-9 rounded-xl bg-violet-600 flex items-center justify-center shadow-[0_0_20px_rgba(124,58,237,0.3)] group-hover:scale-110 transition-transform">
            <Zap className="w-5 h-5 text-white" />
          </div>
          <div>
            <span className="text-white text-lg font-bold tracking-tight block leading-tight group-hover:text-violet-400 transition-colors">
              Workflow Engine
            </span>
            <span className="text-[#64748B] text-xs">Halleyx 2026</span>
          </div>
        </Link>

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
                    ? 'bg-violet-600/20 text-violet-300 font-medium border-l-2 border-violet-400'
                    : 'text-[#94A3B8] hover:text-white hover:bg-[#1A1A2E]'
                  }
                `}
              >
                <Icon className="w-5 h-5" />
                {label}
              </NavLink>
            );
          })}
        </nav>

        {/* ── user profile section ─────────────────────────── */}
        <div className="px-4 py-4 bg-[#080812] border-t border-[#1E1E35] relative">
          <button 
            onClick={() => setShowDropdown(!showDropdown)}
            className="w-full flex items-center gap-3 p-2 rounded-xl hover:bg-[#1A1A2E] transition-all group"
          >
            <div className="w-10 h-10 rounded-full bg-violet-600 flex items-center justify-center text-white font-black text-sm shadow-[0_0_15px_rgba(124,58,237,0.2)]">
              {user?.username?.charAt(0).toUpperCase() || 'U'}
            </div>
            <div className="text-left overflow-hidden">
              <p className="text-sm font-bold text-white truncate">{user?.username || 'User'}</p>
              <p className="text-xs text-[#64748B] truncate">{user?.email || 'email@example.com'}</p>
            </div>
            <Settings className="w-4 h-4 text-[#64748B] group-hover:text-violet-400 ml-auto transition-colors" />
          </button>

          {/* User Dropdown */}
          <AnimatePresence>
            {showDropdown && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowDropdown(false)} />
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  className="absolute bottom-full left-4 right-4 mb-2 bg-[#1A1A2E] border border-[#1E1E35] rounded-2xl p-2 shadow-2xl z-50 overflow-hidden"
                >
                  <div className="p-3 border-b border-[#1E1E35] mb-1">
                    <p className="text-xs font-bold text-[#64748B] uppercase tracking-widest mb-1">Logged in as</p>
                    <p className="text-sm font-black text-white">{user?.username}</p>
                  </div>
                  <button 
                    onClick={() => { setShowProfileModal(true); setShowDropdown(false); }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[#94A3B8] hover:text-white hover:bg-violet-600/20 rounded-lg transition"
                  >
                    <UserIcon className="w-4 h-4" /> Profile Settings
                  </button>
                  <button 
                    onClick={logout}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:text-red-300 hover:bg-red-400/10 rounded-lg transition"
                  >
                    <LogOut className="w-4 h-4" /> Sign Out
                  </button>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
      </aside>

      {/* ── Profile settings modal ─────────────────────────── */}
      <AnimatePresence>
        {showProfileModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-[#080812]/80 backdrop-blur-sm"
              onClick={() => setShowProfileModal(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-md bg-[#FFFFFF] border border-[#E5E7EB] rounded-3xl p-8 shadow-[0_25px_50px_rgba(0,0,0,0.15)] overflow-hidden"
            >
              <div className="absolute top-[-20%] right-[-20%] w-[60%] h-[60%] bg-violet-600/10 blur-[80px] rounded-full" />
              
              <div className="flex items-center justify-between mb-8 relative z-10">
                <h2 className="text-2xl font-black text-[#111827] tracking-tight">Profile Settings</h2>
                <button onClick={() => setShowProfileModal(false)} className="p-2 hover:bg-[#F3F0FF] rounded-xl text-[#6B7280] hover:text-[#111827] transition">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleUpdateProfile} className="space-y-6 relative z-10">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-[#6B7280] uppercase tracking-widest ml-1">Username</label>
                  <div className="relative">
                    <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9CA3AF]" />
                    <input 
                      type="text" 
                      value={profileData.username} 
                      onChange={e => setProfileData({ ...profileData, username: e.target.value })}
                      className="w-full bg-[#F8F7FF] border border-[#E5E7EB] text-[#111827] rounded-xl pl-10 pr-4 py-3 text-sm focus:outline-none focus:border-violet-400 focus:shadow-[0_0_0_3px_rgba(124,58,237,0.08)] transition-all"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-[#6B7280] uppercase tracking-widest ml-1">Email Address</label>
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9CA3AF]" />
                    <input 
                      type="email" 
                      value={profileData.email} 
                      onChange={e => setProfileData({ ...profileData, email: e.target.value })}
                      className="w-full bg-[#F8F7FF] border border-[#E5E7EB] text-[#111827] rounded-xl pl-10 pr-4 py-3 text-sm focus:outline-none focus:border-violet-400 focus:shadow-[0_0_0_3px_rgba(124,58,237,0.08)] transition-all"
                    />
                  </div>
                </div>

                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  type="submit"
                  disabled={saving}
                  className="w-full bg-violet-600 hover:bg-violet-500 text-white font-bold py-3.5 rounded-2xl flex items-center justify-center gap-2 transition-all shadow-[0_0_20px_rgba(124,58,237,0.3)] disabled:opacity-50"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  {saving ? 'Saving...' : 'Save Changes'}
                </motion.button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
