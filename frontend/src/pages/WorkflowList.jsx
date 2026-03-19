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
            <h2 className="text-2xl font-bold text-[#111827]">Workflows</h2>
            <p className="text-[#6B7280] text-sm mt-1">Manage and execute your workflows</p>
          </div>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => navigate('/workflows/new')}
            className="bg-violet-600 hover:bg-violet-500 text-white px-5 py-2.5 rounded-xl font-medium flex items-center gap-2 transition-all duration-200 shadow-[0_4px_12px_rgba(124,58,237,0.3)] hover:shadow-[0_8px_20px_rgba(124,58,237,0.4)]"
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
        <div className="bg-[#FFFFFF] border border-[#E5E7EB] rounded-2xl p-4 mb-6 flex flex-col sm:flex-row items-center gap-4 shadow-[0_4px_24px_rgba(0,0,0,0.06)]">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9CA3AF]" />
            <input
              type="text"
              placeholder="Search workflows..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="w-full bg-[#F8F7FF] border border-[#E5E7EB] text-[#111827] rounded-xl pl-10 pr-4 py-2.5 text-sm placeholder-[#9CA3AF] focus:outline-none focus:border-violet-400 focus:shadow-[0_0_0_3px_rgba(124,58,237,0.08)] transition-all duration-200"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className="bg-[#F8F7FF] border border-[#E5E7EB] text-[#111827] rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-violet-400 focus:shadow-[0_0_0_3px_rgba(124,58,237,0.08)] min-w-[140px] transition-all duration-200"
          >
            <option value="">All Statuses</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
          <span className="text-xs text-[#6B7280] whitespace-nowrap">
            Showing {workflows.length} of {totalCount} workflows
          </span>
        </div>

        {/* ── table ───────────────────────────────────────────────── */}
        <div className="bg-[#FFFFFF] border border-[#E5E7EB] rounded-2xl overflow-hidden shadow-[0_4px_24px_rgba(0,0,0,0.06)]">
          <div className="overflow-x-auto w-full">
            <table className="w-full min-w-[900px]">
              <thead>
                <tr className="bg-[#F8F7FF] border-b border-[#E5E7EB]">
                  <th className="px-6 py-4 text-left text-[#6B7280] text-xs uppercase tracking-wider font-bold">ID</th>
                  <th className="px-6 py-4 text-left text-[#6B7280] text-xs uppercase tracking-wider font-bold">Name</th>
                  <th className="px-6 py-4 text-center text-[#6B7280] text-xs uppercase tracking-wider font-bold">Steps</th>
                  <th className="px-6 py-4 text-center text-[#6B7280] text-xs uppercase tracking-wider font-bold">Version</th>
                  <th className="px-6 py-4 text-center text-[#6B7280] text-xs uppercase tracking-wider font-bold">Status</th>
                  <th className="px-6 py-4 text-left text-[#6B7280] text-xs uppercase tracking-wider font-bold">Created</th>
                  <th className="px-6 py-4 text-right text-[#6B7280] text-xs uppercase tracking-wider font-bold">Actions</th>
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
                          <GitBranch className="w-16 h-16 mb-4 text-[#E5E7EB]" />
                          <p className="font-semibold text-[#111827] text-lg">No workflows found</p>
                          <p className="text-[#6B7280] text-sm mt-1">Create your first workflow to get started</p>
                          <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => navigate('/workflows/new')}
                            className="mt-5 border border-violet-200 text-violet-600 hover:bg-violet-50 px-5 py-2.5 rounded-xl text-sm font-medium flex items-center gap-2 transition-all"
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
                      className="border-b border-[#E5E7EB] hover:bg-[#F3F0FF] transition-colors group"
                    >
                      {/* ID */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs text-[#6B7280]">{trunc(wf.id)}</span>
                          <button
                            onClick={() => handleCopy(wf.id)}
                            className="opacity-0 group-hover:opacity-100 p-1 rounded-md hover:bg-[#E5E7EB] transition-all"
                            title="Copy full ID"
                          >
                            {copiedId === wf.id
                              ? <Check className="w-3 h-3 text-emerald-600" />
                              : <Copy className="w-3 h-3 text-[#6B7280]" />
                            }
                          </button>
                        </div>
                      </td>

                      {/* Name */}
                      <td className="px-6 py-4">
                        <span
                          className="text-[#111827] font-semibold hover:text-violet-600 cursor-pointer transition"
                          onClick={() => navigate(`/workflows/${wf.id}/edit`)}
                        >
                          {wf.name}
                        </span>
                      </td>

                      {/* Steps */}
                      <td className="px-6 py-4 text-center">
                        <span className="inline-flex items-center justify-center bg-[#F3F0FF] border border-[#E5E7EB] text-[#6B7280] text-xs rounded-full px-2.5 py-0.5 font-medium">
                          {wf.step_count || 0}
                        </span>
                      </td>

                      {/* Version */}
                      <td className="px-6 py-4 text-center text-sm text-[#6B7280]">
                        v{wf.version || 1}
                      </td>

                      {/* Status */}
                      <td className="px-6 py-4 text-center">
                        <StatusBadge status={wf.is_active ? 'active' : 'inactive'} size="sm" />
                      </td>

                      {/* Created */}
                      <td className="px-6 py-4 text-sm text-[#6B7280] whitespace-nowrap">
                        {fmt(wf.created_at)}
                      </td>

                      {/* Actions */}
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2 text-[#9CA3AF]">
                          <button
                            onClick={() => navigate(`/workflows/${wf.id}/edit`)}
                            className="p-2 rounded-lg hover:text-violet-600 hover:bg-violet-50 transition-all duration-200"
                            title="Edit Workflow"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => navigate(`/workflows/${wf.id}/execute`)}
                            className="p-2 rounded-lg hover:text-emerald-600 hover:bg-emerald-50 transition-all duration-200"
                            title="Execute Workflow"
                          >
                            <Play className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setDeleteTarget(wf)}
                            className="p-2 rounded-lg hover:text-red-600 hover:bg-red-50 transition-all duration-200"
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
            <div className="bg-[#F8F7FF] border-t border-[#E5E7EB] px-6 py-4 flex items-center justify-between">
              <span className="text-sm text-[#6B7280]">
                Showing {(page - 1) * 10 + 1}-{Math.min(page * 10, totalCount)} of {totalCount} workflows
              </span>
              <div className="flex items-center gap-1">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm text-[#6B7280] hover:text-[#111827] hover:bg-[#FFFFFF] hover:shadow-sm disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                >
                  <ChevronLeft className="w-4 h-4" /> Previous
                </button>
                {pageNumbers.map((n) => (
                  <button
                    key={n}
                    onClick={() => setPage(n)}
                    className={`w-8 h-8 rounded-lg text-sm font-medium transition-all ${
                      n === page
                        ? 'bg-violet-600 text-white shadow-[0_4px_12px_rgba(124,58,237,0.3)]'
                        : 'text-[#6B7280] hover:bg-[#FFFFFF] hover:text-[#111827] hover:shadow-sm'
                    }`}
                  >
                    {n}
                  </button>
                ))}
                <button
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm text-[#6B7280] hover:text-[#111827] hover:bg-[#FFFFFF] hover:shadow-sm disabled:opacity-40 disabled:cursor-not-allowed transition-all"
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


      </motion.div>
    </Layout>
  );
}
