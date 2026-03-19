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
  { key: 'total', label: 'Total', icon: Activity, color: 'text-violet-600', bg: 'bg-[#FFFFFF]', border: 'border-[#E5E7EB]' },
  { key: 'completed', label: 'Completed', icon: CheckCircle2, color: 'text-emerald-600', bg: 'bg-[#FFFFFF]', border: 'border-[#E5E7EB]' },
  { key: 'failed', label: 'Failed', icon: AlertCircle, color: 'text-red-600', bg: 'bg-[#FFFFFF]', border: 'border-[#E5E7EB]' },
  { key: 'in_progress', label: 'In Progress', icon: Loader2, color: 'text-blue-600', bg: 'bg-[#FFFFFF]', border: 'border-[#E5E7EB]' },
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
            <h2 className="text-2xl font-bold text-[#111827]">Audit Log</h2>
            <p className="text-[#6B7280] text-sm mt-1">Track all workflow execution history</p>
          </div>
          <motion.button whileHover={{ rotate: 180 }} transition={{ duration: 0.3 }}
            onClick={fetchExecutions}
            className="p-2.5 bg-[#FFFFFF] border border-[#E5E7EB] rounded-xl hover:border-violet-300 transition text-[#6B7280] hover:text-violet-600 shadow-[0_4px_12px_rgba(0,0,0,0.05)]"
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
              className={`p-4 ${s.bg} rounded-2xl border ${s.border} shadow-[0_4px_24px_rgba(0,0,0,0.04)] hover:shadow-[0_8px_32px_rgba(0,0,0,0.08)] transition-all`}
            >
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-bold text-[#6B7280] uppercase tracking-widest">{s.label}</p>
                <s.icon className={`w-4 h-4 ${s.color}`} />
              </div>
              <p className={`text-2xl font-black mt-1 text-[#111827]`}>{stats[s.key]}</p>
            </motion.div>
          ))}
        </div>

        {/* Filter Bar */}
        <div className="bg-[#FFFFFF] border border-[#E5E7EB] rounded-2xl p-4 flex flex-col sm:flex-row gap-4 items-center shadow-[0_4px_24px_rgba(0,0,0,0.06)]">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9CA3AF]" />
            <input 
              type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search workflow name..."
              className="w-full bg-[#F8F7FF] border border-[#E5E7EB] text-[#111827] rounded-xl pl-10 pr-4 py-2.5 text-sm placeholder-[#9CA3AF] focus:outline-none focus:border-violet-400 focus:shadow-[0_0_0_3px_rgba(124,58,237,0.08)] transition-all"
            />
          </div>
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <select 
              value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
              className="bg-[#F8F7FF] border border-[#E5E7EB] text-[#111827] rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-violet-400 focus:shadow-[0_0_0_3px_rgba(124,58,237,0.08)] transition-all flex-1 sm:flex-none appearance-none cursor-pointer"
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
        <div className="bg-[#FFFFFF] border border-[#E5E7EB] rounded-2xl overflow-hidden shadow-[0_4px_24px_rgba(0,0,0,0.06)]">
          <div className="overflow-x-auto w-full">
            <table className="w-full min-w-[1000px] text-sm">
              <thead>
                <tr className="bg-[#F8F7FF] border-b border-[#E5E7EB]">
                  {['Exec ID', 'Workflow', 'Ver', 'Status', 'Started By', 'Start Time', 'Duration', 'Actions'].map(h => (
                    <th key={h} className={`px-6 py-4 text-[#6B7280] text-xs uppercase tracking-wider font-bold ${h === 'Actions' ? 'text-right' : 'text-left'}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  [...Array(5)].map((_, i) => (
                    <tr key={i} className="animate-pulse border-b border-[#E5E7EB]">
                      <td colSpan="8" className="px-6 py-5"><div className="h-4 bg-[#E5E7EB] rounded w-full" /></td>
                    </tr>
                  ))
                ) : executions.map((ex, index) => (
                  <motion.tr 
                    key={ex.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.03 }}
                    className="group border-b border-[#E5E7EB] hover:bg-[#F3F0FF] transition-colors cursor-pointer"
                    onClick={() => navigate(`/executions/${ex.id}`)}
                  >
                    <td className="px-6 py-4">
                      <span className="bg-[#F3F0FF] border border-[#E5E7EB] px-2 py-1 rounded-lg font-mono text-[10px] text-[#6B7280]">
                        {ex.id.substring(0,8)}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-bold text-[#111827]">{ex.workflow_name || 'Workflow'}</td>
                    <td className="px-6 py-4">
                      <span className="text-[10px] px-2 py-0.5 bg-[#F3F0FF] text-[#6B7280] border border-[#E5E7EB] rounded-full font-bold">v{ex.workflow_version || 1}</span>
                    </td>
                    <td className="px-6 py-4"><StatusBadge status={ex.status} size="sm" /></td>
                    <td className="px-6 py-4 text-[#6B7280]">{ex.triggered_by || 'system'}</td>
                    <td className="px-6 py-4 text-[#6B7280] whitespace-nowrap">{fmt(ex.started_at)}</td>
                    <td className="px-6 py-4 text-[#6B7280] font-mono text-xs">{fmtDur(ex.started_at, ex.ended_at)}</td>
                    <td className="px-6 py-4 text-right" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        <button 
                          onClick={() => navigate(`/executions/${ex.id}`)}
                          className="p-1.5 text-[#9CA3AF] hover:text-violet-600 hover:bg-violet-50 rounded-lg transition"
                          title="View Details"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        {ex.status === 'failed' && (
                          <button 
                            onClick={() => handleRetry(ex.id)}
                            className="p-1.5 text-[#9CA3AF] hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition"
                            title="Retry"
                          >
                            <RotateCcw className="w-4 h-4" />
                          </button>
                        )}
                        {ex.status === 'in_progress' && (
                          <button 
                            onClick={() => handleCancel(ex.id)}
                            className="p-1.5 text-[#9CA3AF] hover:text-red-600 hover:bg-red-50 rounded-lg transition"
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
                        <ClipboardList className="w-16 h-16 mb-3 text-[#E5E7EB]" />
                        <p className="font-bold text-lg text-[#111827]">No execution records</p>
                        <p className="text-sm text-[#6B7280] mt-1">Start a workflow to see history here.</p>
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
              className="flex items-center gap-1 px-4 py-2.5 bg-[#FFFFFF] border border-[#E5E7EB] rounded-xl text-sm font-medium text-[#6B7280] hover:text-[#111827] hover:border-violet-300 hover:shadow-[0_4px_12px_rgba(0,0,0,0.05)] transition-all disabled:opacity-40"
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
                      ? 'bg-violet-600 text-white shadow-[0_4px_12px_rgba(124,58,237,0.3)]'
                      : 'text-[#6B7280] hover:bg-[#FFFFFF] hover:text-[#111827] hover:shadow-sm'
                  }`}
                >
                  {i + 1}
                </button>
              ))}
            </div>
            <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.95 }}
              disabled={page === totalPages} onClick={() => setPage(p => p + 1)}
              className="flex items-center gap-1 px-4 py-2.5 bg-[#FFFFFF] border border-[#E5E7EB] rounded-xl text-sm font-medium text-[#6B7280] hover:text-[#111827] hover:border-violet-300 hover:shadow-[0_4px_12px_rgba(0,0,0,0.05)] transition-all disabled:opacity-40"
            >
              Next <ChevronRight className="w-4 h-4" />
            </motion.button>
          </div>
        )}

      </motion.div>
    </Layout>
  );
}
