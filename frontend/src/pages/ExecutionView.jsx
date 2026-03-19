import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Play, CheckCircle2, Clock, ChevronDown, ChevronUp,
  User, ArrowRight, Loader2, Zap, RotateCcw, XCircle,
  Mail, ChevronRight
} from 'lucide-react';
import Layout from '../components/Layout';
import StatusBadge from '../components/StatusBadge';
import { useToast } from '../components/Toast';
import { useNotifications } from '../context/NotificationContext';
import {
  getWorkflow, executeWorkflow, getExecution,
  approveExecution, cancelExecution, retryExecution
} from '../services/api';
import { useAuth } from '../context/AuthContext';

/* ── notification helpers ──────────────────────────────────────────────── */
const CHANNEL_ICONS_EV = { email: '📧', slack: '💬', sms: '📱' };
const getChannelIcon = (ch) => CHANNEL_ICONS_EV[(ch || '').toLowerCase()] || '🔔';

/** Replace {{fieldName}} and {fieldName} with values from data */
const resolveTemplate = (template, data) => {
  if (!template || typeof template !== 'string') return template || '';
  if (!data || typeof data !== 'object') return template;
  let resolved = template.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (m, k) =>
    data[k] !== undefined && data[k] !== null ? String(data[k]) : m
  );
  resolved = resolved.replace(/\{\s*([\w.]+)\s*\}/g, (m, k) =>
    data[k] !== undefined && data[k] !== null ? String(data[k]) : m
  );
  return resolved;
};

const parseNotificationLog = (log, inputData = {}) => {
  let meta = {};
  try {
    if (typeof log.metadata === 'string') meta = JSON.parse(log.metadata || '{}');
    else if (typeof log.metadata === 'object') meta = log.metadata || {};
  } catch (e) { meta = {}; }

  const rawTo = meta.to || meta.email || meta.assignee_email || meta.recipient || meta.address || '';
  const rawTemplate = meta.template || meta.message || meta.body || meta.content || '';

  return {
    id: log.id,
    step_name: log.step_name,
    step_type: log.step_type,
    channel: meta.channel || 'email',
    to: resolveTemplate(rawTo, inputData),
    template: resolveTemplate(rawTemplate, inputData),
    status: log.status,
    sent_at: log.ended_at,
    execution_id: log.execution_id,
  };
};



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
  const { addToast, addNotification } = useNotifications();

  const { user } = useAuth();
  const [workflow, setWorkflow] = useState(null);
  const [execution, setExecution] = useState(null);
  const [loading, setLoading] = useState(true);

  const [inputData, setInputData] = useState({});
  const [triggeredBy, setTriggeredBy] = useState(user?.username || 'anonymous');
  const [isStarting, setIsStarting] = useState(false);

  const pollRef = useRef(null);
  const shownNotificationsRef = useRef(new Set());
  const [approving, setApproving] = useState(false);
  const [expandedLogs, setExpandedLogs] = useState({});

  const toggleLog = (logId) => {
    setExpandedLogs(prev => ({ ...prev, [logId]: !prev[logId] }));
  };

  /* ── Notification toast trigger ─────────────────────────────────────── */
  const showNotificationToasts = useCallback((exec) => {
    const notifLogs = (exec.logs || []).filter(
      log => log.step_type === 'notification' && log.status === 'completed'
    );
    notifLogs.forEach((log, index) => {
      if (!shownNotificationsRef.current.has(log.id)) {
        shownNotificationsRef.current.add(log.id);
        const parsed = parseNotificationLog(log, exec.input_data || {});
        setTimeout(() => {
          addToast({
            step_name: parsed.step_name,
            to: parsed.to,
            channel: parsed.channel,
            template: parsed.template,
            step_id: parsed.id,
            sent_at: parsed.sent_at,
          });
        }, index * 800);
      }
    });
  }, [addToast]);

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
      showNotificationToasts(data);
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
  }, [workflow?.id, loadWorkflow, showToast, showNotificationToasts]);

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
  const notifiedTerminalRef = useRef(false);
  const notifiedApprovalRef = useRef(false);

  const startPolling = (eid) => {
    if (pollRef.current) return;
    pollRef.current = setInterval(async () => {
      try {
        const { data } = await getExecution(eid);
        if (!data) return;
        setExecution(data);
        showNotificationToasts(data);
        const status = data?.status;

        // Fire approval-required notification once
        if (status === 'in_progress' && !notifiedApprovalRef.current) {
          const pendingLog = data.logs?.find(l => l.status === 'in_progress' && l.step_type === 'approval');
          if (pendingLog) {
            notifiedApprovalRef.current = true;
            addNotification('info', 'Approval required', `Approval required for step "${pendingLog.step_name}" in "${data.workflow_name || 'workflow'}"`, { execution_id: eid, workflow_name: data.workflow_name, step_name: pendingLog.step_name });
          }
        }

        if (['completed', 'failed', 'canceled'].includes(status)) {
          stopPolling();
          if (!notifiedTerminalRef.current) {
            notifiedTerminalRef.current = true;
            if (status === 'completed') {
              addNotification('success', 'Workflow completed', `Workflow "${data.workflow_name || 'workflow'}" completed successfully`, { execution_id: eid, workflow_name: data.workflow_name });
            } else if (status === 'failed') {
              const failedLog = data.logs?.find(l => l.status === 'failed');
              addNotification('error', 'Workflow failed', `Workflow "${data.workflow_name || 'workflow'}" failed at step "${failedLog?.step_name || 'unknown'}"`, { execution_id: eid, workflow_name: data.workflow_name, step_name: failedLog?.step_name });
            }
          }
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
      addNotification('info', 'Workflow started', `Workflow "${workflow?.name}" execution started`, { execution_id: data.id, workflow_name: workflow?.name });
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
      addNotification('success', 'Step approved', `Step was approved in "${workflow?.name || 'workflow'}"`, { execution_id: execution.id, workflow_name: workflow?.name });
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
      addNotification('error', 'Step rejected', `Step was rejected in "${workflow?.name || 'workflow'}"`, { execution_id: execution.id, workflow_name: workflow?.name });
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
    const wid = execution?.workflow_id || workflow?.id;
    if (!wid) { showToast('No workflow found to re-execute', 'error'); return; }
    stopPolling();
    setExecution(null);
    setInputData({});
    setTriggeredBy('');
    loadWorkflow(wid);
    navigate(`/workflows/${wid}/execute`, { replace: true });
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
        <div className="bg-[#FFFFFF] border border-[#E5E7EB] rounded-2xl p-8 shadow-[0_4px_24px_rgba(0,0,0,0.06)]">
          <h3 className="text-xl font-bold text-[#111827] mb-2">Enter Execution Data</h3>
          <p className="text-sm text-[#6B7280] mb-6">Provide the required fields to trigger the workflow engine.</p>

          <div className="space-y-5">
            {schemaEntries.map(([fieldName, fieldConfig]) => {
              const isRequired = fieldConfig.required === true;
              const fieldType = fieldConfig.type;
              const allowedValues = fieldConfig.allowed_values;

              return (
                <div key={fieldName}>
                  <label className="block text-xs font-semibold text-[#6B7280] uppercase tracking-wider mb-2">
                    {fieldName.charAt(0).toUpperCase() + fieldName.slice(1)}
                    {isRequired && <span className="text-red-500 ml-1">*</span>}
                  </label>

                  {allowedValues && allowedValues.length > 0 ? (
                    <select
                      value={inputData[fieldName] || ''}
                      onChange={e => setInputData(prev => ({ ...prev, [fieldName]: e.target.value }))}
                      className="w-full bg-[#F8F7FF] border border-[#E5E7EB] text-[#111827] rounded-xl px-4 py-3 focus:outline-none focus:border-violet-400 focus:shadow-[0_0_0_3px_rgba(124,58,237,0.08)] transition-all"
                    >
                      <option value="">Select {fieldName}...</option>
                      {allowedValues.map(val => (
                        <option key={val} value={val}>{val}</option>
                      ))}
                    </select>
                  ) : fieldType === 'boolean' ? (
                    <label className="flex items-center gap-3 p-3 bg-[#F8F7FF] rounded-xl border border-[#E5E7EB] cursor-pointer hover:border-violet-300 transition">
                      <input
                        type="checkbox" checked={inputData[fieldName] || false}
                        onChange={e => setInputData(prev => ({ ...prev, [fieldName]: e.target.checked }))}
                        className="w-5 h-5 rounded text-violet-600 bg-[#FFFFFF] border-[#E5E7EB]"
                      />
                      <span className="text-sm text-[#6B7280]">Enable this option</span>
                    </label>
                  ) : (
                    <input
                      type={fieldType === 'number' ? 'number' : 'text'}
                      value={inputData[fieldName] || ''}
                      onChange={e => setInputData(prev => ({
                        ...prev,
                        [fieldName]: fieldType === 'number' ? (parseFloat(e.target.value) || '') : e.target.value
                      }))}
                      className="w-full bg-[#F8F7FF] border border-[#E5E7EB] text-[#111827] rounded-xl px-4 py-3 placeholder-[#9CA3AF] focus:outline-none focus:border-violet-400 focus:shadow-[0_0_0_3px_rgba(124,58,237,0.08)] transition-all"
                      placeholder={`Enter ${fieldName}...`}
                    />
                  )}
                </div>
              );
            })}

            <div className="pt-4 border-t border-[#E5E7EB]">
              <label className="block text-xs font-semibold text-[#6B7280] uppercase tracking-wider mb-2">Triggered By</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9CA3AF]" />
                <input
                  type="text" value={triggeredBy}
                  readOnly
                  className="w-full bg-[#F3F0FF] border border-[#E5E7EB] text-[#9CA3AF] rounded-xl pl-10 pr-4 py-3 cursor-not-allowed italic text-sm"
                />
              </div>
              <p className="text-[10px] text-violet-500 mt-2 ml-1">Automatically identified as {user?.username}</p>
            </div>

            <motion.button
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleStart}
              disabled={isStarting}
              className="w-full bg-violet-600 hover:bg-violet-500 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-3 transition-all shadow-[0_4px_12px_rgba(124,58,237,0.3)] hover:shadow-[0_8px_20px_rgba(124,58,237,0.4)] disabled:opacity-50"
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
        <div className="bg-[#FFFFFF] border border-[#E5E7EB] rounded-2xl p-6 flex flex-wrap items-center justify-between gap-4 shadow-[0_4px_24px_rgba(0,0,0,0.06)]">
          <div className="flex items-center gap-4">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${ex.status === 'completed' ? 'bg-emerald-100' :
                ex.status === 'failed' ? 'bg-red-100' :
                  'bg-violet-100'
              }`}>
              {ex.status === 'in_progress'
                ? <Zap className="w-6 h-6 text-violet-600 animate-pulse" />
                : ex.status === 'completed'
                  ? <CheckCircle2 className="w-6 h-6 text-emerald-600" />
                  : <XCircle className="w-6 h-6 text-red-600" />
              }
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-[#111827]">Execution {ex.status.replace('_', ' ')}</h2>
                <StatusBadge status={ex.status} size="sm" />
              </div>
              <p className="text-xs text-[#6B7280] font-mono mt-0.5">ID: {ex.id}</p>
            </div>
          </div>
          <div className="flex gap-8 text-sm">
            <div><p className="text-[#6B7280] font-medium">Started</p><p className="font-bold text-[#111827]">{fmtTime(ex.started_at)}</p></div>
            <div><p className="text-[#6B7280] font-medium">Duration</p><p className="font-bold text-[#111827]">{fmtDuration(ex.started_at, ex.ended_at || new Date())}</p></div>
          </div>
        </div>

        <div className="grid grid-cols-12 gap-8">
          {/* Step Progress Tracker */}
          <div className="col-span-12 lg:col-span-4">
            <div className="bg-[#FFFFFF] border border-[#E5E7EB] rounded-2xl p-6 space-y-6 sticky top-24 shadow-[0_4px_24px_rgba(0,0,0,0.06)]">
              <h3 className="font-bold text-[#111827] flex items-center gap-2">
                <Clock className="w-5 h-5 text-violet-600" /> Step Progress
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
                            log ? 'bg-emerald-500 border-emerald-500' :
                              isCurrent ? 'bg-violet-600 border-violet-600 shadow-[0_4px_12px_rgba(124,58,237,0.3)]' :
                                'bg-[#F3F0FF] border-[#E5E7EB]'
                          }`}>
                          {isFailed ? <XCircle className="w-4 h-4 text-white" /> :
                            log ? <CheckCircle2 className="w-4 h-4 text-white" /> :
                              isCurrent ? <Loader2 className="w-4 h-4 text-white animate-spin" /> :
                                <div className="w-2 h-2 rounded-full bg-[#9CA3AF]" />}
                        </div>
                        <div className="flex-1 pb-6">
                          <p className={`text-sm font-bold ${isPending ? 'text-[#9CA3AF]' : 'text-[#111827]'}`}>{s.name}</p>
                          <p className="text-[10px] text-[#6B7280] uppercase font-semibold">{s.step_type}</p>
                          {log && !isFailed && <p className="text-[10px] text-emerald-600 font-bold mt-1">Completed in {fmtDuration(log.started_at, log.ended_at)}</p>}
                          {isCurrent && <p className="text-[10px] text-violet-600 font-bold animate-pulse mt-1">Processing...</p>}
                          {isPending && <p className="text-[10px] text-[#9CA3AF] mt-1">Waiting...</p>}
                        </div>
                      </div>
                      {i < steps.length - 1 && (
                        <div className={`ml-3.5 h-4 w-px ${log ? 'bg-emerald-500/30' : 'bg-[#E5E7EB]'}`} />
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

              let approverEmail = 'Approver Pool';
              try {
                const step = workflow?.steps?.find(s => s.id === currentStepLog?.step_id);
                const meta = typeof step?.metadata === 'string' ? JSON.parse(step.metadata) : step?.metadata;
                approverEmail = meta?.assignee_email || 'Approver Pool';
              } catch {}

              return (
                <motion.div
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="bg-gradient-to-br from-indigo-50 to-purple-50 border border-violet-200 rounded-2xl p-8 relative overflow-hidden shadow-[0_4px_24px_rgba(124,58,237,0.06)]"
                >
                  <div className="absolute top-0 right-0 p-8 opacity-10"><Mail className="w-32 h-32 text-violet-600" /></div>
                  <div className="relative z-10">
                    <h3 className="text-xl font-bold text-[#111827] mb-2 flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-blue-500 animate-pulse" />
                      Waiting for Email Approval
                    </h3>
                    <p className="text-sm text-[#6B7280] mb-5">An approval email has been sent to the approver. This page will update automatically when they respond.</p>

                    <div className="p-4 bg-[#FFFFFF]/80 backdrop-blur rounded-xl border border-violet-100 mb-5 space-y-2">
                      <p className="text-sm font-medium text-[#6B7280]">Step: <span className="font-bold text-[#111827]">{currentStepLog?.step_name}</span></p>
                      <p className="text-sm text-[#6B7280]">Sent to: <span className="font-bold text-violet-600">{approverEmail}</span></p>
                    </div>

                    <div className="border-t border-violet-200 pt-5">
                      <p className="text-xs text-[#6B7280] font-semibold uppercase tracking-wider mb-3">Or approve manually:</p>
                      <div className="flex flex-col sm:flex-row items-end gap-3">
                        <div className="w-full sm:w-48">
                          <label className="block text-[10px] font-bold uppercase tracking-widest text-[#6B7280] mb-1">Your Name / ID</label>
                          <input
                            type="text" value={approverId} onChange={e => setApproverId(e.target.value)}
                            className="w-full bg-[#FFFFFF] border border-[#E5E7EB] text-[#111827] rounded-xl px-3 py-2.5 text-sm placeholder-[#9CA3AF] focus:outline-none focus:border-violet-400 transition-all"
                            placeholder="Your name"
                          />
                        </div>
                        <div className="flex gap-2 w-full sm:w-auto">
                          <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.95 }}
                            onClick={handleApprove} disabled={approving}
                            className="flex-1 sm:flex-none bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-6 py-2.5 rounded-xl transition-all disabled:opacity-50 shadow-[0_4px_12px_rgba(16,185,129,0.3)]"
                          >
                            {approving ? '...' : '✅ Approve'}
                          </motion.button>
                          <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.95 }}
                            onClick={handleReject} disabled={approving}
                            className="flex-1 sm:flex-none bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 font-bold px-6 py-2.5 rounded-xl transition-all disabled:opacity-50"
                          >
                            {approving ? '...' : '❌ Reject'}
                          </motion.button>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })()}

            {/* Terminal Status Cards */}
            {execution?.status === 'completed' && (
              <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                className="bg-emerald-50 border border-emerald-200 rounded-2xl p-8 text-center shadow-[0_4px_24px_rgba(16,185,129,0.06)]"
              >
                <div className="text-5xl mb-3">🎉</div>
                <h3 className="text-emerald-700 text-2xl font-bold">Workflow Completed Successfully!</h3>
                <p className="text-emerald-600 mt-2">All steps finished in {fmtDuration(execution.started_at, execution.ended_at)}</p>
                <div className="mt-6 flex justify-center gap-3">
                  <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.95 }}
                    onClick={() => navigate('/audit')}
                    className="bg-[#FFFFFF] border border-[#E5E7EB] text-[#6B7280] hover:text-[#111827] font-bold px-6 py-2.5 rounded-xl transition-all flex items-center gap-2 shadow-sm"
                  >
                    📋 Audit Log
                  </motion.button>
                  <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.95 }}
                    onClick={handleExecuteAgain}
                    className="bg-violet-600 hover:bg-violet-500 text-white font-bold px-6 py-2.5 rounded-xl transition-all flex items-center gap-2 shadow-[0_4px_12px_rgba(124,58,237,0.3)] hover:shadow-[0_8px_20px_rgba(124,58,237,0.4)]"
                  >
                    <Play className="w-4 h-4" /> Execute Again
                  </motion.button>
                </div>
              </motion.div>
            )}

            {execution?.status === 'canceled' && (
              <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                className="bg-gray-50 border border-gray-200 rounded-2xl p-8 text-center shadow-[0_4px_24px_rgba(0,0,0,0.04)]"
              >
                <div className="text-5xl mb-3">⛔</div>
                <h3 className="text-gray-700 text-2xl font-bold">Execution Canceled</h3>
                <p className="text-[#6B7280] mt-2">This workflow was terminated before completion.</p>
                <div className="mt-6 flex justify-center">
                  <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.95 }}
                    onClick={handleExecuteAgain}
                    className="bg-violet-600 hover:bg-violet-500 text-white font-bold px-6 py-2.5 rounded-xl transition-all flex items-center gap-2 shadow-[0_4px_12px_rgba(124,58,237,0.3)] hover:shadow-[0_8px_20px_rgba(124,58,237,0.4)]"
                  >
                    <Play className="w-4 h-4" /> Execute Again
                  </motion.button>
                </div>
              </motion.div>
            )}

            {execution?.status === 'failed' && (
              <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                className="bg-red-50 border border-red-200 rounded-2xl p-8 text-center shadow-[0_4px_24px_rgba(239,68,68,0.06)]"
              >
                <div className="text-5xl mb-3">❌</div>
                <h3 className="text-red-700 text-2xl font-bold">Execution Failed</h3>
                <p className="text-red-600 mt-2 max-w-md mx-auto">{execution.error_message || 'An error occurred during execution.'}</p>
                <div className="mt-6 flex justify-center gap-3">
                  <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.95 }}
                    onClick={handleRetry}
                    className="bg-red-100 hover:bg-red-200 text-red-700 border border-red-300 font-bold px-6 py-3 rounded-xl transition-all flex items-center gap-2"
                  >
                    <RotateCcw className="w-5 h-5" /> Retry Failed Step
                  </motion.button>
                  <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.95 }}
                    onClick={handleExecuteAgain}
                    className="bg-violet-600 hover:bg-violet-500 text-white font-bold px-6 py-3 rounded-xl transition-all flex items-center gap-2 shadow-[0_4px_12px_rgba(124,58,237,0.3)] hover:shadow-[0_8px_20px_rgba(124,58,237,0.4)]"
                  >
                    <Play className="w-4 h-4" /> Execute Again
                  </motion.button>
                </div>
              </motion.div>
            )}

            {/* Execution Logs */}
            <div className="space-y-4">
              <h3 className="font-bold text-[#111827] text-lg ml-1">📋 Execution Logs</h3>
              <div className="space-y-2">
                {sortedLogs.map((log, idx) => (
                  <motion.div
                    key={log.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    className="bg-[#FFFFFF] border border-[#E5E7EB] rounded-xl overflow-hidden shadow-sm"
                  >
                    <button
                      onClick={() => toggleLog(log.id)}
                      className="w-full px-5 py-4 flex items-center justify-between hover:bg-[#F8F7FF] transition-all"
                    >
                      <div className="flex items-center gap-4">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${log.status === 'failed' ? 'bg-red-100 text-red-600' : 'bg-violet-100 text-violet-600'
                          }`}>
                          <span className="text-xs font-bold">{idx + 1}</span>
                        </div>
                        <div className="text-left">
                          <p className="text-sm font-bold text-[#111827]">{log.step_name}</p>
                          <p className="text-[10px] text-[#6B7280] font-medium uppercase">{log.step_type} • {fmtDuration(log.started_at, log.ended_at)}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <StatusBadge status={log.status} size="sm" />
                        {expandedLogs[log.id] ? <ChevronUp className="w-4 h-4 text-[#9CA3AF]" /> : <ChevronDown className="w-4 h-4 text-[#9CA3AF]" />}
                      </div>
                    </button>

                    {expandedLogs[log.id] && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        className="px-5 pb-5 pt-2 border-t border-[#E5E7EB] bg-[#F8F7FF]"
                      >
                        <div className="space-y-4">
                          <div>
                            <p className="text-[10px] font-bold text-[#6B7280] uppercase tracking-widest mb-3">Rules Evaluated</p>
                            <div className="space-y-2">
                              {log.evaluated_rules?.map((r, ri) => (
                                <div key={ri} className={`flex items-start gap-3 p-3 rounded-lg border ${r.result
                                    ? 'bg-emerald-50 border-emerald-200'
                                    : 'bg-red-50 border-red-200'
                                  }`}>
                                  {r.result
                                    ? <span className="bg-emerald-100 text-emerald-700 border border-emerald-200 text-[10px] font-bold px-2 py-0.5 rounded-full">MATCH</span>
                                    : <span className="bg-red-100 text-red-700 border border-red-200 text-[10px] font-bold px-2 py-0.5 rounded-full">FALSE</span>
                                  }
                                  <code className="text-xs font-mono text-[#6B7280] flex-1 break-all">{r.rule}</code>
                                  <span className="text-[10px] font-bold text-[#9CA3AF]">P{r.priority || ri + 1}</span>
                                </div>
                              ))}
                              {(!log.evaluated_rules || log.evaluated_rules.length === 0) && <p className="text-xs text-[#9CA3AF] italic py-2">No rules evaluated for this step type.</p>}
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-4 pt-4 border-t border-[#E5E7EB] text-[11px]">
                            <div><p className="text-[#6B7280] font-bold uppercase mb-1">Duration</p><p className="text-[#111827] font-mono">{fmtDuration(log.started_at, log.ended_at)}</p></div>
                            <div><p className="text-[#6B7280] font-bold uppercase mb-1">Completed At</p><p className="text-[#111827] font-mono">{fmtTime(log.ended_at)}</p></div>
                            {log.selected_next_step && <div className="col-span-2"><p className="text-[#6B7280] font-bold uppercase mb-1">Selected Next Path</p><div className="flex items-center gap-2 text-violet-600 font-bold"><ArrowRight className="w-3 h-3" /> {log.selected_next_step}</div></div>}
                            {log.error_message && <div className="col-span-2"><p className="text-red-500 font-bold uppercase mb-1">Error</p><p className="text-red-700 bg-red-100 p-2 rounded-lg border border-red-200 italic">{log.error_message}</p></div>}
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </motion.div>
                ))}
              </div>
            </div>

            {/* ── Notifications Sent Panel ─────────────────────────── */}
            {(() => {
              const notificationLogs = sortedLogs
                .filter(l => l.step_type === 'notification')
                .map(l => parseNotificationLog(l, execution?.input_data || {}));
              if (notificationLogs.length === 0) return null;
              return (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4 }}
                  className="mt-6 rounded-2xl p-6 shadow-[0_4px_24px_rgba(0,0,0,0.06)]"
                  style={{ background: '#FFFFFF', border: '1px solid #E5E7EB' }}
                >
                  {/* Panel header */}
                  <div className="flex items-center gap-3 mb-5">
                    <h3 className="text-[#111827] font-bold text-lg">📨 Notifications Sent</h3>
                    <span className="bg-violet-100 text-violet-600 border border-violet-200 text-xs font-bold px-2.5 py-0.5 rounded-full">
                      {notificationLogs.length}
                    </span>
                  </div>

                  {/* Notification cards */}
                  <AnimatePresence>
                    {notificationLogs.map((notif, index) => {
                      const isDelivered = notif.status === 'completed';
                      return (
                        <motion.div
                          key={notif.id}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: index * 0.1 }}
                          className="mb-3 rounded-xl p-4 shadow-sm"
                          style={{
                            background: '#F8F7FF',
                            border: '1px solid #E5E7EB',
                            borderLeft: '4px solid #7c3aed',
                          }}
                        >
                          {/* Top row */}
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                              <span className="text-lg">{getChannelIcon(notif.channel)}</span>
                              <span className="text-[#111827] font-semibold text-sm">{notif.step_name}</span>
                            </div>
                            <span
                              className="text-xs font-bold px-3 py-1 rounded-full"
                              style={isDelivered
                                ? { background: '#d1fae5', color: '#059669', border: '1px solid #a7f3d0' }
                                : { background: '#fee2e2', color: '#dc2626', border: '1px solid #fecaca' }
                              }
                            >
                              {isDelivered ? '✅ Delivered' : '❌ Failed'}
                            </span>
                          </div>

                          {/* Details */}
                          <div className="space-y-1.5 mb-3">
                            {notif.to && (
                              <p className="text-[#4B5563] text-sm">
                                <span className="text-[#9CA3AF]">To:</span> {notif.to}
                              </p>
                            )}
                            <p className="text-[#4B5563] text-sm capitalize">
                              <span className="text-[#9CA3AF]">Channel:</span> {notif.channel}
                            </p>
                            {notif.sent_at && (
                              <p className="text-[#4B5563] text-sm">
                                <span className="text-[#9CA3AF]">Time:</span>{' '}
                                {new Date(notif.sent_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                              </p>
                            )}
                          </div>

                          {/* Message template */}
                          {notif.template ? (
                            <div className="rounded-lg p-3" style={{ background: '#FFFFFF', border: '1px solid #E5E7EB' }}>
                              <p className="text-[#6B7280] text-sm italic">💬 "{notif.template}"</p>
                            </div>
                          ) : (
                            <p className="text-[#9CA3AF] text-xs italic">No template defined</p>
                          )}
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                </motion.div>
              );
            })()}
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
        <div className="flex items-center gap-2 text-xs text-[#6B7280] mb-6 px-1">
          <span className="cursor-pointer hover:text-[#111827] transition" onClick={() => navigate('/workflows')}>Workflows</span>
          <ChevronRight className="w-3 h-3" />
          <span className="font-bold text-[#111827]">{workflow?.name || 'Loading...'}</span>
          {execution && (
            <>
              <ChevronRight className="w-3 h-3" />
              <span className="text-[#6B7280] font-mono">{execution?.id?.substring(0, 8)}</span>
            </>
          )}
        </div>

        {!execution ? renderInputForm() : renderProgress()}
      </div>
    </Layout>
  );
}
