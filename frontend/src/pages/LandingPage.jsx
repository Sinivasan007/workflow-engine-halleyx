import React, { useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  Zap, Lock, Activity
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function LandingPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAuthenticated = !!user;

  // Strict redirect for logged-in users
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/workflows', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  if (isAuthenticated) return null;

  return (
    <div className="min-h-screen bg-[#080812] text-white overflow-x-hidden selection:bg-violet-500/30 font-sans">
      
      {/* ── Navbar ────────────────────────────────────────────── */}
      <nav className="fixed top-0 left-0 right-0 h-20 px-8 md:px-20 flex items-center justify-between z-50">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-violet-600 flex items-center justify-center shadow-[0_4px_12px_rgba(124,58,237,0.3)]">
            <span className="text-white font-black text-xl">W</span>
          </div>
          <span className="text-xl font-bold tracking-tight text-white/90">Workflow Engine</span>
        </div>

        <div className="flex items-center gap-6">
          <Link to="/signin" className="text-sm font-semibold text-white/60 hover:text-white transition px-4 py-2 border border-white/10 rounded-lg hover:bg-white/5">
            Sign In
          </Link>
          <Link to="/signup" className="px-5 py-2.5 bg-violet-600 hover:bg-violet-500 rounded-lg text-sm font-bold transition shadow-[0_4px_15px_rgba(124,58,237,0.3)] text-white">
            Sign Up
          </Link>
        </div>
      </nav>

      {/* ── Hero Section ──────────────────────────────────────── */}
      <section className="relative pt-44 pb-32 px-8 flex flex-col items-center text-center">
        
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="max-w-4xl"
        >
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-violet-900/20 border border-violet-500/30 text-violet-400 text-[10px] font-bold uppercase tracking-widest mb-10">
            <div className="w-1.5 h-1.5 rounded-full bg-violet-500 animate-pulse" />
            Workflow Automation Platform
          </div>
          
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight leading-[1.1] mb-8 text-white">
            Build and automate your <br/>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 via-fuchsia-400 to-indigo-400">
              workflows
            </span>
          </h1>
          
          <p className="text-lg md:text-xl text-white/50 max-w-2xl mx-auto leading-relaxed mb-12 font-medium">
            Design multi-step workflows with conditional rules, approval gates, 
            and real-time execution tracking — all in one place.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <motion.button 
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => navigate('/signup')}
              className="px-10 py-5 bg-violet-600 hover:bg-violet-500 text-white font-bold rounded-xl transition shadow-[0_10px_25px_rgba(124,58,237,0.4)]"
            >
              Get Started Free
            </motion.button>
            <motion.button 
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => navigate('/signin')}
              className="px-10 py-5 bg-transparent border border-white/10 hover:bg-white/5 text-white font-bold rounded-xl transition"
            >
              Sign In
            </motion.button>
          </div>
        </motion.div>
      </section>

      {/* ── Features Section ──────────────────────────────────── */}
      <section className="pb-32 px-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          
          {/* Rule Engine */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            className="p-8 bg-[#141428] border border-[#2D2D5E] rounded-2xl hover:border-violet-500/40 transition-all group"
          >
            <div className="w-10 h-10 rounded-lg bg-orange-500/10 flex items-center justify-center mb-6">
              <Zap className="w-5 h-5 text-orange-400 group-hover:text-orange-300 transition-colors" />
            </div>
            <h3 className="text-base font-bold mb-3 text-white/90">Rule Engine</h3>
            <p className="text-sm text-white/50 leading-relaxed">
              Conditional branching with AND/OR logic, comparisons, and string functions.
            </p>
          </motion.div>

          {/* Approval Gates */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
            className="p-8 bg-[#141428] border border-[#2D2D5E] rounded-2xl hover:border-violet-500/40 transition-all group"
          >
            <div className="w-10 h-10 rounded-lg bg-yellow-500/10 flex items-center justify-center mb-6">
              <Lock className="w-5 h-5 text-yellow-400 group-hover:text-yellow-300 transition-colors" />
            </div>
            <h3 className="text-base font-bold mb-3 text-white/90">Approval Gates</h3>
            <p className="text-sm text-white/50 leading-relaxed">
              Pause execution for human approval before proceeding to the next step.
            </p>
          </motion.div>

          {/* Audit Logs */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
            className="p-8 bg-[#141428] border border-[#2D2D5E] rounded-2xl hover:border-violet-500/40 transition-all group"
          >
            <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center mb-6">
              <Activity className="w-5 h-5 text-blue-400 group-hover:text-blue-300 transition-colors" />
            </div>
            <h3 className="text-base font-bold mb-3 text-white/90">Audit Logs</h3>
            <p className="text-sm text-white/50 leading-relaxed">
              Full execution history with per-step rule evaluation results.
            </p>
          </motion.div>

        </div>
      </section>

    </div>
  );
}
