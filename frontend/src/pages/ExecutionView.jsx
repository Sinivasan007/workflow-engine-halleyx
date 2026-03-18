import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Play, CheckCircle2, Clock, ChevronDown, ChevronUp,
  User, ArrowRight, Loader2, Zap, RotateCcw, XCircle,
  Mail, ChevronRight
} from 'lucide-react';
import Layout from '../components/Layout';
import StatusBadge from '../components/StatusBadge';
import { useToast } from '../components/Toast';
import {
  getWorkflow, executeWorkflow, getExecution,
  approveExecution, cancelExecution, retryExecution
} from '../services/api';

/* ── helpers ───────────────────────────────────────────────────────────── */
const fmtTime = (d) => d ? new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '--:--:--';
const fmtDuration = (s, e) => {
  if (!s || !e) return '00:00:00';
  const diff = Math.floor((new Date(e) - new Date(s)) / 1000);
  const hrs = Math.floor(diff / 3600).toString().padStart(2, '0');
  const min = Math.floor((diff % 3600) / 60).toString().padStart(2, '0');
  const sec = (diff % 60).toString().padStart(2, '0');
  return `${hrs}:${min}:${sec}`;
};

export default function ExecutionView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [workflow, setWorkflow] = useState(null);
  const [execution, setExecution] = useState(null);
  const [loading, setLoading] = useState(true);

  const [inputData, setInputData] = useState({});
  const [triggeredBy, setTriggeredBy] = useState('user-sinivasan');
  const [isStarting, setIsStarting] = useState(false);

  const pollRef = useRef(null);
  const [approving, setApproving] = useState(false);
  const [expandedLogs, setExpandedLogs] = useState({});

  const toggleLog = (logId) => {
    setExpandedLogs(prev => ({ ...prev, [logId]: !prev[logId] }));
  };

  /* ── Load Initial State ─────────────────────────────────────────────── */
  const loadWorkflow = useCallback(async (wid) => {
    try {
      const { data } = await getWorkflow(wid);
      setWorkflow(data);
      const schema = typeof data.input_schema === 'string' ? JSON.parse(data.input_schema) : data.input_schema;
      const initial = {};
      if (schema && typeof schema === 'object') {
        Object.entries(schema).forEach(([fieldName, fieldConfig]) => {
          if (fieldConfig.type === 'boolean') initial[fieldName] = false;
          else if (fieldConfig.type === 'number') initial[fieldName] = '';
          else initial[fieldName] = '';
        });
      }
      setInputData(initial);
    } catch { showToast('Failed to load workflow', 'error'); }
  }, [showToast]);

  const loadExecution = useCallback(async (eid) => {
    try {
      const { data } = await getExecution(eid);
      setExecution(data);
      if (!workflow) loadWorkflow(data.workflow_id);

      const status = data.status;
      if (status === 'in_progress' || status === 'pending') {
        startPolling(eid);
      } else {
        stopPolling();
      }
    } catch { showToast('Failed to load execution', 'error'); }
    finally { setLoading(false); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workflow?.id, loadWorkflow, showToast]);

  useEffect(() => {
    const path = window.location.pathname;
    if (path.includes('/executions/')) {
      loadExecution(id);
    } else {
      loadWorkflow(id);
      setLoading(false);
    }
    return () => stopPolling();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  /* ── Polling Logic ──────────────────────────────────────────────────── */
  const startPolling = (eid) => {
    if (pollRef.current) return;
    pollRef.current = setInterval(async () => {
      try {
        const { data } = await getExecution(eid);
        if (!data) return;
        setExecution(data);
        const status = data?.status;
        if (['completed', 'failed', 'canceled'].includes(status)) {
          stopPolling();
        }
      } catch (err) {
        console.error('Polling error:', err);
        stopPolling();
      }
    }, 3000);
  };

  const stopPolling = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };

  /* ── Actions ────────────────────────────────────────────────────────── */
  const handleStart = async () => {
    if (!workflow) return;
    const rawSchema = typeof workflow?.input_schema === 'string' ? JSON.parse(workflow.input_schema) : (workflow?.input_schema || {});
    const missingFields = [];
    Object.entries(rawSchema).forEach(([fieldName, fieldConfig]) => {
      if (fieldConfig.required && !inputData[fieldName] && inputData[fieldName] !== 0) {
        missingFields.push(fieldName);
      }
    });
    if (missingFields.length > 0) {
      return showToast(`Required fields missing: ${missingFields.join(', ')}`, 'error');
    }

    setIsStarting(true);
    try {
      const { data } = await executeWorkflow(id, { input_data: inputData, triggered_by: triggeredBy });
      showToast('Execution started!', 'success');
      navigate(`/executions/${data.id || data.execution_id}`, { replace: true });
    } catch (err) {
      showToast(err.response?.data?.error || 'Start failed', 'error');
    } finally {
      setIsStarting(false);
    }
  };

  const [approverId, setApproverId] = useState('');
  const handleApprove = async () => {
    if (!execution?.id) return;
    setApproving(true);
    try {
      const res = await approveExecution(execution.id, {
        status: 'completed',
        approver_id: approverId || 'user-sinivasan'
      });
      showToast('Step approved', 'success');
      setExecution(res.data);
      setApproverId('');
    } catch (err) {
      showToast(err.response?.data?.error || 'Approval failed', 'error');
    } finally {
      setApproving(false);
    }
  };

  const handleReject = async () => {
    if (!execution?.id) return;
    if (!window.confirm('Reject and cancel this execution?')) return;
    setApproving(true);
    try {
      const res = await cancelExecution(execution.id);
      showToast('Step rejected & execution canceled', 'warning');
      setExecution(res.data);
    } catch (err) {
      showToast(err.response?.data?.error || 'Rejection failed', 'error');
    } finally {
      setApproving(false);
    }
  };

  const handleRetry = async () => {
    if (!execution?.id) return;
    try {
      const res = await retryExecution(execution.id);
      showToast('Retry started', 'success');
      setExecution(res.data);
      if (res.data?.status === 'in_progress') {
        startPolling(execution.id);
      }
    } catch (err) {
      showToast(err.response?.data?.error || 'Retry failed', 'error');
    }
  };

  const handleExecuteAgain = () => {
    stopPolling();
    setExecution(null);
    setInputData({});
    setTriggeredBy('');
    loadWorkflow(id);
    navigate(`/workflows/${id}/execute`, { replace: true });
  };

  /* ── Input Form ──────────────────────────────────────────────────────── */
  const renderInputForm = () => {
    if (!workflow) return null;
    const rawSchema = workflow?.input_schema;
    const schemaObj = typeof rawSchema === 'string' ? JSON.parse(rawSchema) : (rawSchema || {});
    const schemaEntries = Object.entries(schemaObj);

    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="max-w-2xl mx-auto space-y-6"
      >
        <div className="bg-[#141428] border border-[#2D2D5E] rounded-2xl p-8">
          <h3 className="text-xl font-bold text-white mb-2">Enter Execution Data</h3>
          <p className="text-sm text-[#94A3B8] mb-6">Provide the required fields to trigger the workflow engine.</p>

          <div className="space-y-5">
            {schemaEntries.map(([fieldName, fieldConfig]) => {
              const isRequired = fieldConfig.required === true;
              const fieldType = fieldConfig.type;
              const allowedValues = fieldConfig.allowed_values;

              return (
                <div key={fieldName}>
                  <label className="block text-xs font-semibold text-[#94A3B8] uppercase tracking-wider mb-2">
                    {fieldName.charAt(0).toUpperCase() + fieldName.slice(1)}
                    {isRequired && <span className="text-red-400 ml-1">*</span>}
                  </label>

                  {allowedValues && allowedValues.length > 0 ? (
                    <select
                      value={inputData[fieldName] || ''}
                      onChange={e => setInputData(prev => ({ ...prev, [fieldName]: e.target.value }))}
                      className="w-full bg-[#0A0A14] border border-[#2D2D5E] text-white rounded-xl px-4 py-3 focus:outline-none focus:border-indigo-500 transition-all"
                    >
                      <option value="">Select {fieldName}...</option>
                      {allowedValues.map(val => (
                        <option key={val} value={val}>{val}</option>
                      ))}
                    </select>
                  ) : fieldType === 'boolean' ? (
                    <label className="flex items-center gap-3 p-3 bg-[#0A0A14] rounded-xl border border-[#2D2D5E] cursor-pointer hover:border-[#3D3D7E] transition">
                      <input
                        type="checkbox" checked={inputData[fieldName] || false}
                        onChange={e => setInputData(prev => ({ ...prev, [fieldName]: e.target.checked }))}
                        className="w-5 h-5 rounded text-indigo-600 bg-[#0A0A14] border-[#2D2D5E]"
                      />
                      <span className="text-sm text-[#94A3B8]">Enable this option</span>
                    </label>
                  ) : (
                    <input
                      type={fieldType === 'number' ? 'number' : 'text'}
                      value={inputData[fieldName] || ''}
                      onChange={e => setInputData(prev => ({
                        ...prev,
                        [fieldName]: fieldType === 'number' ? (parseFloat(e.target.value) || '') : e.target.value
                      }))}
                      className="w-full bg-[#0A0A14] border border-[#2D2D5E] text-white rounded-xl px-4 py-3 placeholder-[#64748B] focus:outline-none focus:border-indigo-500 focus:shadow-[0_0_0_3px_rgba(99,102,241,0.1)] transition-all"
                      placeholder={`Enter ${fieldName}...`}
                    />
                  )}
                </div>
              );
            })}

            <div className="pt-4 border-t border-[#2D2D5E]">
              <label className="block text-xs font-semibold text-[#94A3B8] uppercase tracking-wider mb-2">Triggered By</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#64748B]" />
                <input
                  type="text" value={triggeredBy}
                  onChange={e => setTriggeredBy(e.target.value)}
                  className="w-full bg-[#0A0A14] border border-[#2D2D5E] text-white rounded-xl pl-10 pr-4 py-3 placeholder-[#64748B] focus:outline-none focus:border-indigo-500 transition-all"
                  placeholder="user-sinivasan"
                />
              </div>
            </div>

            <motion.button
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleStart}
              disabled={isStarting}
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-3 transition-all hover:shadow-[0_0_30px_rgba(99,102,241,0.3)] disabled:opacity-50"
            >
              {isStarting ? <Loader2 className="w-6 h-6 animate-spin" /> : <Play className="w-6 h-6" />}
              {isStarting ? 'Starting...' : 'Start Execution'}
            </motion.button>
          </div>
        </div>
      </motion.div>
    );
  };

  /* ── Execution Progress ──────────────────────────────────────────────── */
  const renderProgress = () => {
    if (!execution) return null;
    const ex = execution;
    const sortedLogs = (ex?.logs || [])
      .map((log, i) => ({ ...log, _idx: i }))
      .sort((a, b) => new Date(a.started_at) - new Date(b.started_at) || a._idx - b._idx);

    const steps = [...(workflow?.steps || [])].sort((a, b) => a.step_order - b.step_order);
    const currentStepId = ex?.current_step_id;

    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="space-y-8"
      >
        {/* Header Card */}
        <div className="bg-[#141428] border border-[#2D2D5E] rounded-2xl p-6 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${ex.status === 'completed' ? 'bg-green-500/20' :
                ex.status === 'failed' ? 'bg-red-500/20' :
                  'bg-indigo-500/20'
              }`}>
              {ex.status === 'in_progress'
                ? <Zap className="w-6 h-6 text-indigo-400 animate-pulse" />
                : ex.status === 'completed'
                  ? <CheckCircle2 className="w-6 h-6 text-green-400" />
                  : <XCircle className="w-6 h-6 text-red-400" />
              }
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-white">Execution {ex.status.replace('_', ' ')}</h2>
                <StatusBadge status={ex.status} size="sm" />
              </div>
              <p className="text-xs text-[#64748B] font-mono mt-0.5">ID: {ex.id}</p>
            </div>
          </div>
          <div className="flex gap-8 text-sm">
            <div><p className="text-[#64748B] font-medium">Started</p><p className="font-bold text-white">{fmtTime(ex.started_at)}</p></div>
            <div><p className="text-[#64748B] font-medium">Duration</p><p className="font-bold text-white">{fmtDuration(ex.started_at, ex.ended_at || new Date())}</p></div>
          </div>
        </div>

        <div className="grid grid-cols-12 gap-8">
          {/* Step Progress Tracker */}
          <div className="col-span-12 lg:col-span-4">
            <div className="bg-[#141428] border border-[#2D2D5E] rounded-2xl p-6 space-y-6 sticky top-24">
              <h3 className="font-bold text-white flex items-center gap-2">
                <Clock className="w-5 h-5 text-indigo-400" /> Step Progress
              </h3>
              <div className="space-y-0.5 ml-2">
                {steps.map((s, i) => {
                  const log = sortedLogs.find(l => l.step_id === s.id && l.status !== 'in_progress');
                  const isCurrent = currentStepId === s.id && ex.status === 'in_progress';
                  const isPending = !log && !isCurrent;
                  const isFailed = sortedLogs.find(l => l.step_id === s.id && l.status === 'failed');

                  return (
                    <React.Fragment key={s.id}>
                      <div className="flex items-start gap-4">
                        <div className={`mt-1 w-7 h-7 rounded-full border-2 flex items-center justify-center z-10 ${isFailed ? 'bg-red-500 border-red-500' :
                            log ? 'bg-green-500 border-green-500' :
                              isCurrent ? 'bg-indigo-600 border-indigo-600 shadow-[0_0_15px_rgba(99,102,241,0.4)]' :
                                'bg-[#1A1A35] border-[#2D2D5E]'
                          }`}>
                          {isFailed ? <XCircle className="w-4 h-4 text-white" /> :
                            log ? <CheckCircle2 className="w-4 h-4 text-white" /> :
                              isCurrent ? <Loader2 className="w-4 h-4 text-white animate-spin" /> :
                                <div className="w-2 h-2 rounded-full bg-[#64748B]" />}
                        </div>
                        <div className="flex-1 pb-6">
                          <p className={`text-sm font-bold ${isPending ? 'text-[#64748B]' : 'text-white'}`}>{s.name}</p>
                          <p className="text-[10px] text-[#64748B] uppercase font-semibold">{s.step_type}</p>
                          {log && !isFailed && <p className="text-[10px] text-green-400 font-bold mt-1">Completed in {fmtDuration(log.started_at, log.ended_at)}</p>}
                          {isCurrent && <p className="text-[10px] text-indigo-400 font-bold animate-pulse mt-1">Processing...</p>}
                          {isPending && <p className="text-[10px] text-[#64748B] mt-1">Waiting...</p>}
                        </div>
                      </div>
                      {i < steps.length - 1 && (
                        <div className={`ml-3.5 h-4 w-px ${log ? 'bg-green-500/30' : 'bg-[#2D2D5E]'}`} />
                      )}
                    </React.Fragment>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Action / Logs Area */}
          <div className="col-span-12 lg:col-span-8 space-y-6">
            {/* Action Required Card */}
            {execution?.status === 'in_progress' && (() => {
              const currentStepLog = execution?.logs?.find(l => l.status === 'in_progress' || l.status === 'pending');
              const isApproval = currentStepLog?.step_type === 'approval';
              if (!isApproval) return null;

              return (
                <motion.div
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="bg-gradient-to-br from-indigo-900/40 to-purple-900/40 border border-indigo-500/40 rounded-2xl p-8 relative overflow-hidden"
                >
                  <div className="absolute top-0 right-0 p-8 opacity-10"><Mail className="w-32 h-32 text-indigo-400" /></div>
                  <div className="relative z-10">
                    <h3 className="text-xl font-bold text-white mb-4">⚡ Action Required</h3>
                    <div className="p-4 bg-[#0A0A14]/60 backdrop-blur rounded-xl border border-[#2D2D5E] mb-6 space-y-2">
                      <p className="text-sm font-medium text-[#94A3B8]">Waiting for approval at step: <span className="font-bold text-white">{currentStepLog?.step_name}</span></p>
                      <p className="text-xs text-[#64748B]">
                        Assigned to: {(() => {
                          try {
                            const step = workflow?.steps?.find(s => s.id === currentStepLog?.step_id);
                            const meta = typeof step?.metadata === 'string' ? JSON.parse(step.metadata) : step?.metadata;
                            return meta?.assignee_email || 'Approver Pool';
                          } catch { return 'Approver Pool'; }
                        })()}
                      </p>
                    </div>

                    <div className="flex flex-col sm:flex-row items-end gap-3">
                      <div className="w-full sm:w-48">
                        <label className="block text-[10px] font-bold uppercase tracking-widest text-[#64748B] mb-1">Your ID (Optional)</label>
                        <input
                          type="text" value={approverId} onChange={e => setApproverId(e.target.value)}
                          className="w-full bg-[#0A0A14] border border-[#2D2D5E] text-white rounded-xl px-3 py-2.5 text-sm placeholder-[#64748B] focus:outline-none focus:border-indigo-500 transition-all"
                          placeholder="mgr_456"
                        />
                      </div>
                      <div className="flex gap-2 w-full sm:w-auto">
                        <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.95 }}
                          onClick={handleApprove} disabled={approving}
                          className="flex-1 sm:flex-none bg-indigo-600 hover:bg-green-600 text-white font-bold px-6 py-2.5 rounded-xl transition-all disabled:opacity-50 hover:shadow-[0_0_20px_rgba(16,185,129,0.3)]"
                        >
                          {approving ? '...' : '✅ Approve'}
                        </motion.button>
                        <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.95 }}
                          onClick={handleReject} disabled={approving}
                          className="flex-1 sm:flex-none bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 font-bold px-6 py-2.5 rounded-xl transition-all disabled:opacity-50"
                        >
                          {approving ? '...' : '✗ Reject'}
                        </motion.button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })()}

            {/* Terminal Status Cards */}
            {execution?.status === 'completed' && (
              <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                className="bg-green-500/10 border border-green-500/30 rounded-2xl p-8 text-center"
              >
                <div className="text-5xl mb-3">🎉</div>
                <h3 className="text-green-400 text-2xl font-bold">Workflow Completed Successfully!</h3>
                <p className="text-green-400/70 mt-2">All steps finished in {fmtDuration(execution.started_at, execution.ended_at)}</p>
                <div className="mt-6 flex justify-center gap-3">
                  <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.95 }}
                    onClick={() => navigate('/audit')}
                    className="bg-[#141428] border border-[#2D2D5E] text-[#94A3B8] hover:text-white font-bold px-6 py-2.5 rounded-xl transition-all flex items-center gap-2"
                  >
                    📋 Audit Log
                  </motion.button>
                  <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.95 }}
                    onClick={handleExecuteAgain}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-6 py-2.5 rounded-xl transition-all flex items-center gap-2 hover:shadow-[0_0_20px_rgba(99,102,241,0.4)]"
                  >
                    <Play className="w-4 h-4" /> Execute Again
                  </motion.button>
                </div>
              </motion.div>
            )}

            {execution?.status === 'canceled' && (
              <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                className="bg-gray-500/10 border border-gray-500/30 rounded-2xl p-8 text-center"
              >
                <div className="text-5xl mb-3">⛔</div>
                <h3 className="text-gray-400 text-2xl font-bold">Execution Canceled</h3>
                <p className="text-[#64748B] mt-2">This workflow was terminated before completion.</p>
                <div className="mt-6 flex justify-center">
                  <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.95 }}
                    onClick={handleExecuteAgain}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-6 py-2.5 rounded-xl transition-all flex items-center gap-2 hover:shadow-[0_0_20px_rgba(99,102,241,0.4)]"
                  >
                    <Play className="w-4 h-4" /> Execute Again
                  </motion.button>
                </div>
              </motion.div>
            )}

            {execution?.status === 'failed' && (
              <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                className="bg-red-500/10 border border-red-500/30 rounded-2xl p-8 text-center"
              >
                <div className="text-5xl mb-3">❌</div>
                <h3 className="text-red-400 text-2xl font-bold">Execution Failed</h3>
                <p className="text-red-400/70 mt-2 max-w-md mx-auto">{execution.error_message || 'An error occurred during execution.'}</p>
                <div className="mt-6 flex justify-center gap-3">
                  <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.95 }}
                    onClick={handleRetry}
                    className="bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 font-bold px-6 py-3 rounded-xl transition-all flex items-center gap-2"
                  >
                    <RotateCcw className="w-5 h-5" /> Retry Failed Step
                  </motion.button>
                  <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.95 }}
                    onClick={handleExecuteAgain}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold px-6 py-3 rounded-xl transition-all flex items-center gap-2 hover:shadow-[0_0_20px_rgba(99,102,241,0.4)]"
                  >
                    <Play className="w-4 h-4" /> Execute Again
                  </motion.button>
                </div>
              </motion.div>
            )}

            {/* Execution Logs */}
            <div className="space-y-4">
              <h3 className="font-bold text-white text-lg ml-1">📋 Execution Logs</h3>
              <div className="space-y-2">
                {sortedLogs.map((log, idx) => (
                  <motion.div
                    key={log.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    className="bg-[#141428] border border-[#2D2D5E] rounded-xl overflow-hidden"
                  >
                    <button
                      onClick={() => toggleLog(log.id)}
                      className="w-full px-5 py-4 flex items-center justify-between hover:bg-[#1A1A35] transition-all"
                    >
                      <div className="flex items-center gap-4">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${log.status === 'failed' ? 'bg-red-500/20 text-red-400' : 'bg-indigo-500/20 text-indigo-400'
                          }`}>
                          <span className="text-xs font-bold">{idx + 1}</span>
                        </div>
                        <div className="text-left">
                          <p className="text-sm font-bold text-white">{log.step_name}</p>
                          <p className="text-[10px] text-[#64748B] font-medium uppercase">{log.step_type} • {fmtDuration(log.started_at, log.ended_at)}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <StatusBadge status={log.status} size="sm" />
                        {expandedLogs[log.id] ? <ChevronUp className="w-4 h-4 text-[#64748B]" /> : <ChevronDown className="w-4 h-4 text-[#64748B]" />}
                      </div>
                    </button>

                    {expandedLogs[log.id] && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        className="px-5 pb-5 pt-2 border-t border-[#2D2D5E] bg-[#0A0A14]"
                      >
                        <div className="space-y-4">
                          <div>
                            <p className="text-[10px] font-bold text-[#64748B] uppercase tracking-widest mb-3">Rules Evaluated</p>
                            <div className="space-y-2">
                              {log.evaluated_rules?.map((r, ri) => (
                                <div key={ri} className={`flex items-start gap-3 p-3 rounded-lg border ${r.result
                                    ? 'bg-green-500/10 border-green-500/30'
                                    : 'bg-red-500/10 border-red-500/30'
                                  }`}>
                                  {r.result
                                    ? <span className="bg-green-500/20 text-green-400 border border-green-500/30 text-[10px] font-bold px-2 py-0.5 rounded-full">MATCH</span>
                                    : <span className="bg-red-500/20 text-red-400 border border-red-500/30 text-[10px] font-bold px-2 py-0.5 rounded-full">FALSE</span>
                                  }
                                  <code className="text-xs font-mono text-[#94A3B8] flex-1 break-all">{r.rule}</code>
                                  <span className="text-[10px] font-bold text-[#64748B]">P{r.priority || ri + 1}</span>
                                </div>
                              ))}
                              {(!log.evaluated_rules || log.evaluated_rules.length === 0) && <p className="text-xs text-[#64748B] italic py-2">No rules evaluated for this step type.</p>}
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-4 pt-4 border-t border-[#2D2D5E] text-[11px]">
                            <div><p className="text-[#64748B] font-bold uppercase mb-1">Duration</p><p className="text-white font-mono">{fmtDuration(log.started_at, log.ended_at)}</p></div>
                            <div><p className="text-[#64748B] font-bold uppercase mb-1">Completed At</p><p className="text-white font-mono">{fmtTime(log.ended_at)}</p></div>
                            {log.selected_next_step && <div className="col-span-2"><p className="text-[#64748B] font-bold uppercase mb-1">Selected Next Path</p><div className="flex items-center gap-2 text-indigo-400 font-bold"><ArrowRight className="w-3 h-3" /> {log.selected_next_step}</div></div>}
                            {log.error_message && <div className="col-span-2"><p className="text-red-400 font-bold uppercase mb-1">Error</p><p className="text-red-400/80 bg-red-500/10 p-2 rounded-lg border border-red-500/30 italic">{log.error_message}</p></div>}
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    );
  };

  if (loading) return (
    <Layout title="Loading Execution...">
      <div className="animate-pulse space-y-6">
        <div className="h-40 bg-[#1A1A35] rounded-2xl" />
        <div className="h-64 bg-[#1A1A35] rounded-2xl" />
      </div>
    </Layout>
  );

  if (!workflow && !execution) {
    return (
      <Layout title="Execute Workflow">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <p className="text-[#94A3B8] text-lg">Workflow not found</p>
            <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.95 }}
              onClick={() => navigate('/workflows')}
              className="mt-4 px-4 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-500 transition-all"
            >
              Back to Workflows
            </motion.button>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout title={execution ? 'Execution Detail' : 'Execute Workflow'}>
      <div className="max-w-6xl mx-auto pb-12">
        {/* Breadcrumb Context */}
        <div className="flex items-center gap-2 text-xs text-[#64748B] mb-6 px-1">
          <span className="cursor-pointer hover:text-indigo-400 transition" onClick={() => navigate('/workflows')}>Workflows</span>
          <ChevronRight className="w-3 h-3" />
          <span className="font-bold text-white">{workflow?.name || 'Loading...'}</span>
          {execution && (
            <>
              <ChevronRight className="w-3 h-3" />
              <span className="text-[#64748B] font-mono">{execution?.id?.substring(0, 8)}</span>
            </>
          )}
        </div>

        {!execution ? renderInputForm() : renderProgress()}
      </div>
    </Layout>
  );
}
