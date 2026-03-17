import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus, Search, Pencil, Play, Trash2,
  GitBranch, BarChart3, AlertCircle, ChevronLeft, ChevronRight,
} from 'lucide-react';
import Layout from '../components/Layout';
import StatusBadge from '../components/StatusBadge';
import Modal from '../components/Modal';
import { useToast } from '../components/Toast';
import { getWorkflows, deleteWorkflow, getExecutions } from '../services/api';

/* ── helpers ───────────────────────────────────────────────────────────── */
const fmt = (d) => {
  if (!d) return '—';
  const dt = new Date(d);
  return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) +
    ', ' + dt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
};
const trunc = (id) => (id || '').substring(0, 8);

/* ── skeleton row ─────────────────────────────────────────────────────── */
function SkeletonRow() {
  return (
    <tr className="animate-pulse">
      {[...Array(7)].map((_, i) => (
        <td key={i} className="px-4 py-4">
          <div className="h-4 bg-gray-200 rounded w-3/4" />
        </td>
      ))}
    </tr>
  );
}

/* ── stat card ─────────────────────────────────────────────────────────── */
function StatCard({ label, value, icon: Icon, color }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 flex items-center gap-4">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${color}`}>
        <Icon className="w-6 h-6 text-white" />
      </div>
      <div>
        <p className="text-2xl font-bold text-gray-900">{value}</p>
        <p className="text-sm text-gray-500">{label}</p>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════ */
export default function WorkflowList() {
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [workflows, setWorkflows]     = useState([]);
  const [loading, setLoading]         = useState(true);
  const [search, setSearch]           = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage]               = useState(1);
  const [totalPages, setTotalPages]   = useState(1);
  const [totalCount, setTotalCount]   = useState(0);
  const [stats, setStats]             = useState({ total: 0, active: 0, executions: 0, failed: 0 });

  /* delete modal */
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting]         = useState(false);

  /* ── fetch workflows ─────────────────────────────────────────────── */
  const fetchWorkflows = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, limit: 10 };
      if (search) params.search = search;
      if (statusFilter) params.status = statusFilter;
      const { data } = await getWorkflows(params);

      const list = data.data || data.workflows || data || [];
      setWorkflows(Array.isArray(list) ? list : []);
      setTotalPages(data.pagination?.totalPages || data.totalPages || 1);
      setTotalCount(data.pagination?.total || data.total || (Array.isArray(list) ? list.length : 0));
    } catch (err) {
      showToast('Failed to load workflows', 'error');
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter, showToast]);

  /* ── fetch stats ─────────────────────────────────────────────────── */
  const fetchStats = useCallback(async () => {
    try {
      const [wfRes, exRes] = await Promise.all([
        getWorkflows({ limit: 1000 }),
        getExecutions({ limit: 1000 }),
      ]);
      const allWf  = wfRes.data.data || wfRes.data.workflows || wfRes.data || [];
      const allEx  = exRes.data.data || exRes.data.executions || exRes.data || [];
      const wfArr  = Array.isArray(allWf) ? allWf : [];
      const exArr  = Array.isArray(allEx) ? allEx : [];

      setStats({
        total:      wfArr.length,
        active:     wfArr.filter((w) => w.is_active === 1 || w.is_active === true || w.status === 'active').length,
        executions: exArr.length,
        failed:     exArr.filter((e) => e.status === 'failed').length,
      });
    } catch {
      /* silent — stats are non-critical */
    }
  }, []);

  useEffect(() => { fetchWorkflows(); }, [fetchWorkflows]);
  useEffect(() => { fetchStats(); }, [fetchStats]);

  /* ── delete ──────────────────────────────────────────────────────── */
  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteWorkflow(deleteTarget.id);
      showToast('Workflow deleted', 'success');
      setDeleteTarget(null);
      fetchWorkflows();
      fetchStats();
    } catch {
      showToast('Failed to delete workflow', 'error');
    } finally {
      setDeleting(false);
    }
  };

  /* ── render ──────────────────────────────────────────────────────── */
  return (
    <Layout title="Workflows">
      {/* header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Workflows</h2>
          <p className="text-gray-500 text-sm mt-1">Manage and execute your workflows</p>
        </div>
        <button
          onClick={() => navigate('/workflows/new')}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition"
        >
          <Plus className="w-4 h-4" /> New Workflow
        </button>
      </div>

      {/* stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total Workflows" value={stats.total}      icon={GitBranch}   color="bg-indigo-600" />
        <StatCard label="Active Workflows" value={stats.active}    icon={BarChart3}   color="bg-emerald-500" />
        <StatCard label="Total Executions" value={stats.executions} icon={Play}        color="bg-blue-500" />
        <StatCard label="Failed Executions" value={stats.failed}   icon={AlertCircle} color="bg-red-500" />
      </div>

      {/* search / filter */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 mb-6 flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search workflows..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full border border-gray-300 rounded-lg pl-9 pr-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent min-w-[140px]"
        >
          <option value="">All Statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
        <span className="text-xs text-gray-400 whitespace-nowrap">
          Showing {workflows.length} of {totalCount}
        </span>
      </div>

      {/* table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto w-full">
        <table className="w-full min-w-[900px]">
          <thead>
            <tr className="bg-gray-50 text-xs font-semibold text-gray-500 uppercase">
              <th className="px-4 py-3 text-left">ID</th>
              <th className="px-4 py-3 text-left">Name</th>
              <th className="px-4 py-3 text-center">Steps</th>
              <th className="px-4 py-3 text-center">Version</th>
              <th className="px-4 py-3 text-center">Status</th>
              <th className="px-4 py-3 text-left">Created</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading
              ? [...Array(5)].map((_, i) => <SkeletonRow key={i} />)
              : workflows.length === 0
              ? (
                <tr>
                  <td colSpan={7}>
                    <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                      <GitBranch className="w-12 h-12 mb-3 text-gray-300" />
                      <p className="font-semibold text-gray-600 text-lg">No workflows yet</p>
                      <p className="text-sm mt-1">Create your first workflow to get started</p>
                      <button
                        onClick={() => navigate('/workflows/new')}
                        className="mt-4 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition"
                      >
                        <Plus className="w-4 h-4" /> Create Workflow
                      </button>
                    </div>
                  </td>
                </tr>
              )
              : workflows.map((wf) => (
                <tr
                  key={wf.id}
                  className="hover:bg-gray-50 border-b border-gray-100 transition"
                >
                  <td className="px-4 py-3 font-mono text-xs text-gray-400">
                    {trunc(wf.id)}
                  </td>
                  <td className="px-4 py-3 font-semibold text-gray-900">
                    {wf.name}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold">
                      {wf.step_count || 0}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center text-sm text-gray-600">
                    v{wf.version || 1}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <StatusBadge status={wf.is_active ? 'active' : 'inactive'} size="sm" />
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">
                    {fmt(wf.created_at)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => navigate(`/workflows/${wf.id}/edit`)}
                        className="p-1.5 rounded-lg text-indigo-600 hover:bg-indigo-50 transition"
                        title="Edit"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => navigate(`/workflows/${wf.id}/execute`)}
                        className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-50 transition"
                        title="Execute"
                      >
                        <Play className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setDeleteTarget(wf)}
                        className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 transition"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
        </div>
      </div>

      {/* pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <button
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
            className="flex items-center gap-1 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 px-4 py-2 rounded-lg text-sm disabled:opacity-40 disabled:cursor-not-allowed transition"
          >
            <ChevronLeft className="w-4 h-4" /> Previous
          </button>
          <span className="text-sm text-gray-500">
            Page {page} of {totalPages}
          </span>
          <button
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
            className="flex items-center gap-1 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 px-4 py-2 rounded-lg text-sm disabled:opacity-40 disabled:cursor-not-allowed transition"
          >
            Next <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* delete modal */}
      <Modal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Delete Workflow?"
        size="sm"
      >
        <p className="text-gray-600 text-sm mb-6">
          This will permanently delete <strong>{deleteTarget?.name}</strong> and
          all its steps, rules, and execution history.
        </p>
        <div className="flex justify-end gap-3">
          <button
            onClick={() => setDeleteTarget(null)}
            className="bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium transition"
          >
            Cancel
          </button>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition disabled:opacity-60"
          >
            <Trash2 className="w-4 h-4" />
            {deleting ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </Modal>
    </Layout>
  );
}
