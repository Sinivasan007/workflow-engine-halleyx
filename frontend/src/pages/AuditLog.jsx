import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  ClipboardList, Search, RefreshCw, Eye, 
  RotateCcw, XCircle, ChevronLeft, ChevronRight,
  Activity, CheckCircle2, AlertCircle, Loader2
} from 'lucide-react';
import Layout from '../components/Layout';
import StatusBadge from '../components/StatusBadge';
import { useToast } from '../components/Toast';
import { getExecutions, retryExecution, cancelExecution } from '../services/api';

const fmt = (d) => {
  if (!d) return '—';
  const dt = new Date(d);
  return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + 
         ' ' + dt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
};

const fmtDur = (s, e) => {
  if (!s || !e) return '—';
  const diff = Math.floor((new Date(e) - new Date(s)) / 1000);
  if (diff < 60) return `${diff}s`;
  return `${Math.floor(diff / 60)}m ${diff % 60}s`;
};

const statConfig = [
  { key: 'total', label: 'Total', icon: Activity, color: 'text-indigo-400', bg: 'bg-indigo-500/10', border: 'border-indigo-500/30' },
  { key: 'completed', label: 'Completed', icon: CheckCircle2, color: 'text-green-400', bg: 'bg-green-500/10', border: 'border-green-500/30' },
  { key: 'failed', label: 'Failed', icon: AlertCircle, color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/30' },
  { key: 'in_progress', label: 'In Progress', icon: Loader2, color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/30' },
];

export default function AuditLog() {
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [executions, setExecutions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [stats, setStats] = useState({ total: 0, completed: 0, failed: 0, in_progress: 0 });

  const fetchExecutions = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, limit: 10 };
      if (search) params.search = search;
      if (statusFilter) params.status = statusFilter;
      
      const { data } = await getExecutions(params);
      const list = data.data || data.executions || data || [];
      setExecutions(list);
      setTotalPages(data.pagination?.totalPages || 1);
      
      if (Array.isArray(list)) {
        const s = { total: data.pagination?.total || list.length, completed: 0, failed: 0, in_progress: 0 };
        list.forEach(ex => {
          if (ex.status === 'completed') s.completed++;
          else if (ex.status === 'failed') s.failed++;
          else if (ex.status === 'in_progress') s.in_progress++;
        });
        setStats(s);
      }
    } catch {
      showToast('Failed to load audit logs', 'error');
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter, showToast]);

  useEffect(() => {
    fetchExecutions();
  }, [fetchExecutions]);

  const handleRetry = async (executionId) => {
    try {
      await retryExecution(executionId);
      showToast('Retry started successfully!', 'success');
      fetchExecutions();
    } catch (err) {
      const msg = err.response?.data?.error || 'Retry failed';
      showToast(msg, 'error');
    }
  };

  const handleCancel = async (executionId) => {
    if (!window.confirm('Cancel this execution?')) return;
    try {
      await cancelExecution(executionId);
      showToast('Execution canceled', 'info');
      fetchExecutions();
    } catch (err) {
      const msg = err.response?.data?.error || 'Cancel failed';
      showToast(msg, 'error');
    }
  };

  return (
    <Layout title="Audit Log">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="space-y-6"
      >
        
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-white">Audit Log</h2>
            <p className="text-[#94A3B8] text-sm mt-1">Track all workflow execution history</p>
          </div>
          <motion.button whileHover={{ rotate: 180 }} transition={{ duration: 0.3 }}
            onClick={fetchExecutions}
            className="p-2.5 bg-[#141428] border border-[#2D2D5E] rounded-xl hover:border-[#3D3D7E] transition text-[#64748B] hover:text-white"
          >
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          </motion.button>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {statConfig.map((s, i) => (
            <motion.div 
              key={s.key}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className={`p-4 ${s.bg} rounded-xl border ${s.border}`}
            >
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-bold text-[#64748B] uppercase tracking-widest">{s.label}</p>
                <s.icon className={`w-4 h-4 ${s.color}`} />
              </div>
              <p className={`text-2xl font-black mt-1 ${s.color}`}>{stats[s.key]}</p>
            </motion.div>
          ))}
        </div>

        {/* Filter Bar */}
        <div className="bg-[#141428] border border-[#2D2D5E] rounded-2xl p-4 flex flex-col sm:flex-row gap-4 items-center">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#64748B]" />
            <input 
              type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search workflow name..."
              className="w-full bg-[#0A0A14] border border-[#2D2D5E] text-white rounded-xl pl-10 pr-4 py-2.5 text-sm placeholder-[#64748B] focus:outline-none focus:border-indigo-500 transition-all"
            />
          </div>
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <select 
              value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
              className="bg-[#0A0A14] border border-[#2D2D5E] text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-indigo-500 transition-all flex-1 sm:flex-none appearance-none cursor-pointer"
            >
              <option value="">All Statuses</option>
              <option value="completed">✅ Completed</option>
              <option value="failed">❌ Failed</option>
              <option value="in_progress">⏳ In Progress</option>
              <option value="canceled">⛔ Canceled</option>
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="bg-[#141428] border border-[#2D2D5E] rounded-2xl overflow-hidden">
          <div className="overflow-x-auto w-full">
            <table className="w-full min-w-[1000px] text-sm">
              <thead>
                <tr className="bg-[#0A0A14] border-b border-[#2D2D5E]">
                  {['Exec ID', 'Workflow', 'Ver', 'Status', 'Started By', 'Start Time', 'Duration', 'Actions'].map(h => (
                    <th key={h} className={`px-6 py-4 text-[#64748B] text-xs uppercase tracking-wider font-medium ${h === 'Actions' ? 'text-right' : 'text-left'}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  [...Array(5)].map((_, i) => (
                    <tr key={i} className="animate-pulse border-b border-[#1A1A35]">
                      <td colSpan="8" className="px-6 py-5"><div className="h-4 bg-[#1A1A35] rounded w-full" /></td>
                    </tr>
                  ))
                ) : executions.map((ex, index) => (
                  <motion.tr 
                    key={ex.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.03 }}
                    className="group border-b border-[#1A1A35] hover:bg-[#1A1A35] transition-colors cursor-pointer"
                    onClick={() => navigate(`/executions/${ex.id}`)}
                  >
                    <td className="px-6 py-4">
                      <span className="bg-[#0A0A14] border border-[#2D2D5E] px-2 py-1 rounded-lg font-mono text-[10px] text-[#64748B]">
                        {ex.id.substring(0,8)}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-bold text-white">{ex.workflow_name || 'Workflow'}</td>
                    <td className="px-6 py-4">
                      <span className="text-[10px] px-2 py-0.5 bg-indigo-500/10 text-indigo-400 border border-indigo-500/30 rounded-full font-bold">v{ex.workflow_version || 1}</span>
                    </td>
                    <td className="px-6 py-4"><StatusBadge status={ex.status} size="sm" /></td>
                    <td className="px-6 py-4 text-[#94A3B8]">{ex.triggered_by || 'system'}</td>
                    <td className="px-6 py-4 text-[#94A3B8] whitespace-nowrap">{fmt(ex.started_at)}</td>
                    <td className="px-6 py-4 text-[#64748B] font-mono text-xs">{fmtDur(ex.started_at, ex.ended_at)}</td>
                    <td className="px-6 py-4 text-right" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        <button 
                          onClick={() => navigate(`/executions/${ex.id}`)}
                          className="p-1.5 text-indigo-400 hover:bg-indigo-500/10 rounded-lg transition"
                          title="View Details"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        {ex.status === 'failed' && (
                          <button 
                            onClick={() => handleRetry(ex.id)}
                            className="p-1.5 text-green-400 hover:bg-green-500/10 rounded-lg transition"
                            title="Retry"
                          >
                            <RotateCcw className="w-4 h-4" />
                          </button>
                        )}
                        {ex.status === 'in_progress' && (
                          <button 
                            onClick={() => handleCancel(ex.id)}
                            className="p-1.5 text-red-400 hover:bg-red-500/10 rounded-lg transition"
                            title="Cancel"
                          >
                            <XCircle className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </motion.tr>
                ))}
                {!loading && executions.length === 0 && (
                  <tr>
                    <td colSpan="8" className="py-20 text-center">
                      <div className="flex flex-col items-center justify-center">
                        <ClipboardList className="w-16 h-16 mb-3 text-[#2D2D5E]" />
                        <p className="font-bold text-lg text-white">No execution records</p>
                        <p className="text-sm text-[#64748B] mt-1">Start a workflow to see history here.</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-2">
            <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.95 }}
              disabled={page === 1} onClick={() => setPage(p => p - 1)}
              className="flex items-center gap-1 px-4 py-2.5 bg-[#0A0A14] border border-[#2D2D5E] rounded-xl text-sm font-medium text-[#94A3B8] hover:text-white hover:border-[#3D3D7E] transition-all disabled:opacity-40"
            >
              <ChevronLeft className="w-4 h-4" /> Previous
            </motion.button>
            <div className="flex items-center gap-2">
              {[...Array(totalPages)].map((_, i) => (
                <button
                  key={i}
                  onClick={() => setPage(i + 1)}
                  className={`w-8 h-8 rounded-lg text-sm font-bold transition-all ${
                    page === i + 1
                      ? 'bg-indigo-600 text-white shadow-[0_0_12px_rgba(99,102,241,0.4)]'
                      : 'text-[#64748B] hover:bg-[#1A1A35] hover:text-white'
                  }`}
                >
                  {i + 1}
                </button>
              ))}
            </div>
            <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.95 }}
              disabled={page === totalPages} onClick={() => setPage(p => p + 1)}
              className="flex items-center gap-1 px-4 py-2.5 bg-[#0A0A14] border border-[#2D2D5E] rounded-xl text-sm font-medium text-[#94A3B8] hover:text-white hover:border-[#3D3D7E] transition-all disabled:opacity-40"
            >
              Next <ChevronRight className="w-4 h-4" />
            </motion.button>
          </div>
        )}

      </motion.div>
    </Layout>
  );
}
