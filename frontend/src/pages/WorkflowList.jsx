import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Plus, Search, Pencil, Play, Trash2,
  GitBranch, CheckCircle, AlertCircle,
  ChevronLeft, ChevronRight, Copy, Check,
} from 'lucide-react';
import Layout from '../components/Layout';
import StatusBadge from '../components/StatusBadge';
import MetricCard from '../components/ui/MetricCard';
import ConfirmModal from '../components/ui/ConfirmModal';
import { SkeletonRow } from '../components/ui/LoadingSkeleton';
import { useToast } from '../components/Toast';
import { getWorkflows, deleteWorkflow, getExecutions } from '../services/api';

/* ── helpers ───────────────────────────────────────────────────────────── */
const fmt = (d) => {
  if (!d) return '—';
  const dt = new Date(d);
  return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};
const trunc = (id) => (id || '').substring(0, 8);

/* ══════════════════════════════════════════════════════════════════════ */
export default function WorkflowList() {
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [workflows, setWorkflows]       = useState([]);
  const [loading, setLoading]           = useState(true);
  const [search, setSearch]             = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage]                 = useState(1);
  const [totalPages, setTotalPages]     = useState(1);
  const [totalCount, setTotalCount]     = useState(0);
  const [stats, setStats]               = useState({ total: 0, active: 0, executions: 0, failed: 0 });

  /* delete modal */
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting]         = useState(false);

  /* copy state */
  const [copiedId, setCopiedId]         = useState(null);

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

  /* ── copy ID ─────────────────────────────────────────────────────── */
  const handleCopy = (id) => {
    navigator.clipboard.writeText(id);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  /* ── pagination helpers ──────────────────────────────────────────── */
  const pageNumbers = [];
  for (let i = 1; i <= totalPages; i++) pageNumbers.push(i);

  /* ── render ──────────────────────────────────────────────────────── */
  return (
    <Layout title="Workflows">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        {/* ── header ──────────────────────────────────────────────── */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl font-bold text-white">Workflows</h2>
            <p className="text-[#94A3B8] text-sm mt-1">Manage and execute your workflows</p>
          </div>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => navigate('/workflows/new')}
            className="bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2.5 rounded-xl font-medium flex items-center gap-2 transition-all duration-200 hover:shadow-[0_0_20px_rgba(99,102,241,0.4)]"
          >
            <Plus className="w-4 h-4" /> New Workflow
          </motion.button>
        </div>

        {/* ── stats ───────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <MetricCard label="Total Workflows"  value={stats.total}      icon={GitBranch}   color="indigo" index={0} />
          <MetricCard label="Active Workflows"  value={stats.active}    icon={CheckCircle} color="green"  index={1} trend={{ up: true, value: 'active' }} />
          <MetricCard label="Total Executions"  value={stats.executions} icon={Play}        color="blue"   index={2} />
          <MetricCard label="Failed Executions" value={stats.failed}    icon={AlertCircle} color="red"    index={3} />
        </div>

        {/* ── search / filter ─────────────────────────────────────── */}
        <div className="bg-[#141428] border border-[#2D2D5E] rounded-2xl p-4 mb-6 flex flex-col sm:flex-row items-center gap-4">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#64748B]" />
            <input
              type="text"
              placeholder="Search workflows..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="w-full bg-[#0A0A14] border border-[#2D2D5E] text-white rounded-xl pl-10 pr-4 py-2.5 text-sm placeholder-[#64748B] focus:outline-none focus:border-indigo-500 focus:shadow-[0_0_0_3px_rgba(99,102,241,0.1)] transition-all duration-200"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className="bg-[#0A0A14] border border-[#2D2D5E] text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-indigo-500 min-w-[140px] transition-all duration-200"
          >
            <option value="">All Statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
          <span className="text-xs text-[#64748B] whitespace-nowrap">
            Showing {workflows.length} of {totalCount} workflows
          </span>
        </div>

        {/* ── table ───────────────────────────────────────────────── */}
        <div className="bg-[#141428] border border-[#2D2D5E] rounded-2xl overflow-hidden">
          <div className="overflow-x-auto w-full">
            <table className="w-full min-w-[900px]">
              <thead>
                <tr className="bg-[#0A0A14] border-b border-[#2D2D5E]">
                  <th className="px-6 py-4 text-left text-[#64748B] text-xs uppercase tracking-wider font-medium">ID</th>
                  <th className="px-6 py-4 text-left text-[#64748B] text-xs uppercase tracking-wider font-medium">Name</th>
                  <th className="px-6 py-4 text-center text-[#64748B] text-xs uppercase tracking-wider font-medium">Steps</th>
                  <th className="px-6 py-4 text-center text-[#64748B] text-xs uppercase tracking-wider font-medium">Version</th>
                  <th className="px-6 py-4 text-center text-[#64748B] text-xs uppercase tracking-wider font-medium">Status</th>
                  <th className="px-6 py-4 text-left text-[#64748B] text-xs uppercase tracking-wider font-medium">Created</th>
                  <th className="px-6 py-4 text-right text-[#64748B] text-xs uppercase tracking-wider font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading
                  ? [...Array(5)].map((_, i) => <SkeletonRow key={i} cols={7} />)
                  : workflows.length === 0
                  ? (
                    <tr>
                      <td colSpan={7}>
                        <div className="flex flex-col items-center justify-center py-20">
                          <GitBranch className="w-16 h-16 mb-4 text-[#2D2D5E]" />
                          <p className="font-semibold text-white text-lg">No workflows found</p>
                          <p className="text-[#94A3B8] text-sm mt-1">Create your first workflow to get started</p>
                          <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => navigate('/workflows/new')}
                            className="mt-5 border border-indigo-500/50 text-indigo-400 hover:bg-indigo-500/10 px-5 py-2.5 rounded-xl text-sm font-medium flex items-center gap-2 transition-all"
                          >
                            <Plus className="w-4 h-4" /> Create Workflow
                          </motion.button>
                        </div>
                      </td>
                    </tr>
                  )
                  : workflows.map((wf, index) => (
                    <motion.tr
                      key={wf.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className="border-b border-[#1A1A35] hover:bg-[#1A1A35] transition-colors group"
                    >
                      {/* ID */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs text-[#64748B]">{trunc(wf.id)}</span>
                          <button
                            onClick={() => handleCopy(wf.id)}
                            className="opacity-0 group-hover:opacity-100 p-1 rounded-md hover:bg-[#2D2D5E] transition-all"
                            title="Copy full ID"
                          >
                            {copiedId === wf.id
                              ? <Check className="w-3 h-3 text-green-400" />
                              : <Copy className="w-3 h-3 text-[#64748B]" />
                            }
                          </button>
                        </div>
                      </td>

                      {/* Name */}
                      <td className="px-6 py-4">
                        <span
                          className="text-white font-semibold hover:text-indigo-400 cursor-pointer transition"
                          onClick={() => navigate(`/workflows/${wf.id}/edit`)}
                        >
                          {wf.name}
                        </span>
                      </td>

                      {/* Steps */}
                      <td className="px-6 py-4 text-center">
                        <span className="inline-flex items-center justify-center bg-[#1A1A35] border border-[#2D2D5E] text-[#94A3B8] text-xs rounded-full px-2.5 py-0.5 font-medium">
                          {wf.step_count || 0}
                        </span>
                      </td>

                      {/* Version */}
                      <td className="px-6 py-4 text-center text-sm text-[#64748B]">
                        v{wf.version || 1}
                      </td>

                      {/* Status */}
                      <td className="px-6 py-4 text-center">
                        <StatusBadge status={wf.is_active ? 'active' : 'inactive'} size="sm" />
                      </td>

                      {/* Created */}
                      <td className="px-6 py-4 text-sm text-[#64748B] whitespace-nowrap">
                        {fmt(wf.created_at)}
                      </td>

                      {/* Actions */}
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => navigate(`/workflows/${wf.id}/edit`)}
                            className="p-1.5 rounded-lg text-[#64748B] hover:text-indigo-400 hover:bg-indigo-500/10 transition-all"
                            title="Edit Workflow"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => navigate(`/workflows/${wf.id}/execute`)}
                            className="p-1.5 rounded-lg text-[#64748B] hover:text-green-400 hover:bg-green-500/10 transition-all"
                            title="Execute Workflow"
                          >
                            <Play className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setDeleteTarget(wf)}
                            className="p-1.5 rounded-lg text-[#64748B] hover:text-red-400 hover:bg-red-500/10 transition-all"
                            title="Delete Workflow"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </motion.tr>
                  ))}
              </tbody>
            </table>
          </div>

          {/* ── pagination ─────────────────────────────────────────── */}
          {totalPages > 1 && (
            <div className="bg-[#0A0A14] border-t border-[#2D2D5E] px-6 py-4 flex items-center justify-between">
              <span className="text-sm text-[#64748B]">
                Showing {(page - 1) * 10 + 1}-{Math.min(page * 10, totalCount)} of {totalCount} workflows
              </span>
              <div className="flex items-center gap-1">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm text-[#94A3B8] hover:text-white hover:bg-[#1A1A35] disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                >
                  <ChevronLeft className="w-4 h-4" /> Previous
                </button>
                {pageNumbers.map((n) => (
                  <button
                    key={n}
                    onClick={() => setPage(n)}
                    className={`w-8 h-8 rounded-lg text-sm font-medium transition-all ${
                      n === page
                        ? 'bg-indigo-600 text-white shadow-[0_0_10px_rgba(99,102,241,0.3)]'
                        : 'text-[#94A3B8] hover:bg-[#1A1A35] hover:text-white'
                    }`}
                  >
                    {n}
                  </button>
                ))}
                <button
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm text-[#94A3B8] hover:text-white hover:bg-[#1A1A35] disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                >
                  Next <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ── delete modal ────────────────────────────────────────── */}
        <ConfirmModal
          isOpen={!!deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onConfirm={handleDelete}
          title="Delete Workflow?"
          message={`This will permanently delete "${deleteTarget?.name}" and all its steps, rules, and execution history.`}
          loading={deleting}
        />

        {/* ── floating action button ──────────────────────────────── */}
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={() => navigate('/workflows/new')}
          className="fixed bottom-8 right-8 w-14 h-14 bg-indigo-600 rounded-full shadow-[0_0_30px_rgba(99,102,241,0.4)] hover:bg-indigo-500 flex items-center justify-center transition-all z-30"
          title="New Workflow"
        >
          <Plus className="w-6 h-6 text-white" />
        </motion.button>
      </motion.div>
    </Layout>
  );
}
