import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  ClipboardList, Search, RefreshCw, Eye, 
  RotateCcw, XCircle, ChevronLeft, ChevronRight
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
      setTotalPages(data.totalPages || 1);
      
      // Compute simple stats for current view / or ideally from backend
      if (Array.isArray(list)) {
        const s = { total: list.length, completed: 0, failed: 0, in_progress: 0 };
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
      <div className="space-y-6">
        
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Audit Log</h2>
            <p className="text-gray-500 text-sm mt-1">Track all workflow execution history</p>
          </div>
          <button 
            onClick={fetchExecutions}
            className="p-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition text-gray-500"
          >
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Total', value: stats.total, color: 'text-indigo-600', bg: 'bg-indigo-50' },
            { label: 'Completed', value: stats.completed, color: 'text-emerald-600', bg: 'bg-emerald-50' },
            { label: 'Failed', value: stats.failed, color: 'text-red-600', bg: 'bg-red-50' },
            { label: 'In Progress', value: stats.in_progress, color: 'text-blue-600', bg: 'bg-blue-50' }
          ].map((s, i) => (
            <div key={i} className={`p-4 rounded-xl border border-gray-100 ${s.bg}`}>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">{s.label}</p>
              <p className={`text-2xl font-black mt-1 ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* Filter Bar */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 flex flex-col sm:flex-row gap-4 items-center">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input 
              type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search workflow name..."
              className="w-full border border-gray-300 rounded-lg pl-10 pr-4 py-2 text-sm focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <select 
              value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 flex-1 sm:flex-none"
            >
              <option value="">All Statuses</option>
              <option value="completed">Completed</option>
              <option value="failed">Failed</option>
              <option value="in_progress">In Progress</option>
              <option value="canceled">Canceled</option>
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto w-full">
            <table className="w-full min-w-[1000px] text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr className="text-left text-xs font-bold text-gray-400 uppercase tracking-widest">
                  <th className="px-6 py-4">Exec ID</th>
                  <th className="px-6 py-4">Workflow</th>
                  <th className="px-6 py-4">Ver</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Started By</th>
                  <th className="px-6 py-4 whitespace-nowrap">Start Time</th>
                  <th className="px-6 py-4 whitespace-nowrap">Duration</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {loading ? (
                  [...Array(5)].map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td colSpan="8" className="px-6 py-4"><div className="h-4 bg-gray-100 rounded w-full" /></td>
                    </tr>
                  ))
                ) : executions.map((ex) => (
                  <tr key={ex.id} className="hover:bg-gray-50 transition-colors group">
                    <td className="px-6 py-4 font-mono text-[10px] text-gray-400">{ex.id.substring(0,8)}</td>
                    <td className="px-6 py-4 font-bold text-gray-900">{ex.workflow_name || 'Workflow'}</td>
                    <td className="px-6 py-4"><span className="text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded font-bold">v{ex.workflow_version || 1}</span></td>
                    <td className="px-6 py-4"><StatusBadge status={ex.status} size="sm" /></td>
                    <td className="px-6 py-4 text-gray-500">{ex.triggered_by || 'system'}</td>
                    <td className="px-6 py-4 text-gray-500 whitespace-nowrap">{fmt(ex.started_at)}</td>
                    <td className="px-6 py-4 text-gray-400 font-mono text-[11px]">{fmtDur(ex.started_at, ex.ended_at)}</td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button 
                          onClick={() => navigate(`/executions/${ex.id}`)}
                          className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg transition"
                          title="View Details"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        {ex.status === 'failed' && (
                          <button 
                            onClick={() => handleRetry(ex.id)}
                            className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition"
                            title="Retry"
                          >
                            <RotateCcw className="w-4 h-4" />
                          </button>
                        )}
                        {ex.status === 'in_progress' && (
                          <button 
                            onClick={() => handleCancel(ex.id)}
                            className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition"
                            title="Cancel"
                          >
                            <XCircle className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {!loading && executions.length === 0 && (
                  <tr>
                    <td colSpan="8" className="py-20 text-center">
                      <div className="flex flex-col items-center justify-center text-gray-400">
                        <ClipboardList className="w-12 h-12 mb-3 opacity-20" />
                        <p className="font-bold text-lg text-gray-600">No execution records</p>
                        <p className="text-sm">Start a workflow to see history here.</p>
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
          <div className="flex items-center justify-between pt-4">
            <button 
              disabled={page === 1} onClick={() => setPage(p => p - 1)}
              className="flex items-center gap-1 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 transition disabled:opacity-40"
            >
              <ChevronLeft className="w-4 h-4" /> Previous
            </button>
            <span className="text-sm font-bold text-gray-500">Page {page} of {totalPages}</span>
            <button 
              disabled={page === totalPages} onClick={() => setPage(p => p + 1)}
              className="flex items-center gap-1 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 transition disabled:opacity-40"
            >
              Next <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}

      </div>
    </Layout>
  );
}
