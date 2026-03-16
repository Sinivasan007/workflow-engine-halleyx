import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
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
  approveExecution, cancelExecution
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
  const { id } = useParams(); // Workflow ID or Execution ID
  const navigate = useNavigate();
  const { showToast } = useToast();
  
  const [workflow, setWorkflow] = useState(null);
  const [execution, setExecution] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // Section 1: Input Setup
  const [inputData, setInputData] = useState({});
  const [triggeredBy, setTriggeredBy] = useState('user123');
  const [isStarting, setIsStarting] = useState(false);

  // Section 2: Real-time Polling
  const pollRef = useRef(null);

  // Approving state
  const [approving, setApproving] = useState(false);

  // Section 3: Log Accordion
  const [expandedLogs, setExpandedLogs] = useState({});

  const toggleLog = (logId) => {
    setExpandedLogs(prev => ({ ...prev, [logId]: !prev[logId] }));
  };

  /* ── Load Initial State ─────────────────────────────────────────────── */
  const loadWorkflow = useCallback(async (wid) => {
    try {
      const { data } = await getWorkflow(wid);
      setWorkflow(data);
      // Initialize input data default values
      const schema = typeof data.input_schema === 'string' ? JSON.parse(data.input_schema) : data.input_schema;
      const initial = {};
      schema?.forEach(f => {
        if (f.type === 'boolean') initial[f.name] = false;
        else if (f.type === 'number') initial[f.name] = '';
        else initial[f.name] = '';
      });
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
  }, [workflow, loadWorkflow, showToast]);

  useEffect(() => {
    // If URL is /executions/:id, we load execution. If /workflows/:id/execute, we load workflow.
    const path = window.location.pathname;
    if (path.includes('/executions/')) {
      loadExecution(id);
    } else {
      loadWorkflow(id);
      setLoading(false);
    }
    return () => stopPolling();
  }, [id, loadExecution, loadWorkflow]);

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
    const schema = typeof workflow?.input_schema === 'string' ? JSON.parse(workflow.input_schema) : (workflow?.input_schema || []);
    // Basic validation
    for (const f of schema) {
      if (f.required && !inputData[f.name]) {
        return showToast(`${f.name} is required`, 'error');
      }
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
        approver_id: approverId || 'user123'
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
      await executeWorkflow(workflow.id, { input_data: execution.input_data, triggered_by: triggeredBy });
      showToast('Retry started', 'success');
      navigate('/audit');
    } catch (err) {
      showToast(err.response?.data?.error || 'Retry failed', 'error');
    }
  };

  /* ── Renderers ──────────────────────────────────────────────────────── */
  const renderInputForm = () => {
    if (!workflow) return null;
    const rawSchema = workflow?.input_schema;
    const schema = typeof rawSchema === 'string' ? JSON.parse(rawSchema) : (rawSchema || []);
    return (
      <div className="max-w-2xl mx-auto space-y-6 animate-fadeIn">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
          <h3 className="text-xl font-bold text-gray-900 mb-2">Enter Execution Data</h3>
          <p className="text-sm text-gray-500 mb-6">Provide the required fields to trigger the workflow engine.</p>
          
          <div className="space-y-5">
            {schema.map((field, idx) => (
              <div key={idx}>
                <label className="block text-sm font-semibold text-gray-700 mb-1">
                  {field.name} {field.required && <span className="text-red-500">*</span>}
                </label>
                {field.allowed_values ? (
                  <select 
                    value={inputData[field.name]}
                    onChange={e => setInputData({...inputData, [field.name]: e.target.value})}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">Select an option...</option>
                    {field.allowed_values.split(',').map(v => <option key={v} value={v.trim()}>{v.trim()}</option>)}
                  </select>
                ) : field.type === 'boolean' ? (
                  <label className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg cursor-pointer">
                    <input 
                      type="checkbox" checked={inputData[field.name]}
                      onChange={e => setInputData({...inputData, [field.name]: e.target.checked})}
                      className="w-5 h-5 text-indigo-600 rounded"
                    />
                    <span className="text-sm text-gray-600">Enable this option</span>
                  </label>
                ) : (
                  <input 
                    type={field.type === 'number' ? 'number' : 'text'}
                    value={inputData[field.name]}
                    onChange={e => setInputData({...inputData, [field.name]: e.target.value})}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500"
                    placeholder={`Enter ${field.name}...`}
                  />
                )}
              </div>
            ))}

            <div className="pt-4 border-t border-gray-50">
              <label className="block text-sm font-semibold text-gray-700 mb-1">Triggered By (Username)</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input 
                  type="text" value={triggeredBy}
                  onChange={e => setTriggeredBy(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg pl-10 pr-4 py-2 focus:ring-2 focus:ring-indigo-500"
                  placeholder="e.g. jsmith"
                />
              </div>
            </div>

            <button 
              onClick={handleStart}
              disabled={isStarting}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-3 shadow-lg shadow-indigo-100 transition disabled:opacity-50"
            >
              {isStarting ? <Loader2 className="w-6 h-6 animate-spin" /> : <Play className="w-6 h-6" />}
              Start Execution
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderProgress = () => {
    if (!execution) return null;
    const ex = execution;
    const logs = ex?.logs || [];
    
    // Determine current step index
    const steps = workflow?.steps?.sort((a,b) => a.order_index - b.order_index) || [];
    const currentStepId = ex?.current_step_id;
    
    return (
      <div className="space-y-8 animate-fadeIn">
        {/* Header Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${ex.status === 'completed' ? 'bg-emerald-500' : ex.status === 'failed' ? 'bg-red-500' : 'bg-blue-500'}`}>
              {ex.status === 'in_progress' ? <Zap className="w-6 h-6 text-white animate-pulse" /> : <CheckCircle2 className="w-6 h-6 text-white" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-gray-900">Execution {ex.status.replace('_', ' ')}</h2>
                <StatusBadge status={ex.status} size="sm" />
              </div>
              <p className="text-xs text-gray-400 font-mono mt-0.5">ID: {ex.id}</p>
            </div>
          </div>
          <div className="flex gap-8 text-sm">
            <div><p className="text-gray-400 font-medium">Started</p><p className="font-bold text-gray-900">{fmtTime(ex.started_at)}</p></div>
            <div><p className="text-gray-400 font-medium">Duration</p><p className="font-bold text-gray-900">{fmtDuration(ex.started_at, ex.ended_at || new Date())}</p></div>
          </div>
        </div>

        <div className="grid grid-cols-12 gap-8">
          {/* Tracker */}
          <div className="col-span-12 lg:col-span-4 bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-6">
            <h3 className="font-bold text-gray-900 flex items-center gap-2">
              <Clock className="w-5 h-5 text-indigo-600" /> Step Progress
            </h3>
            <div className="relative space-y-0.5 ml-2">
              {steps.map((s, i) => {
                const log = logs.find(l => l.step_id === s.id && l.status !== 'in_progress');
                const isCurrent = currentStepId === s.id && ex.status === 'in_progress';
                const isPending = !log && !isCurrent;
                
                return (
                  <React.Fragment key={s.id}>
                    <div className="flex items-start gap-4">
                      <div className={`mt-1 w-6 h-6 rounded-full border-2 flex items-center justify-center z-10 ${
                        log ? 'bg-emerald-500 border-emerald-500' : 
                        isCurrent ? 'bg-blue-500 border-blue-500 animate-pulse' : 
                        'bg-white border-gray-200'
                      }`}>
                        {log ? <CheckCircle2 className="w-4 h-4 text-white" /> : 
                         isCurrent ? <Loader2 className="w-4 h-4 text-white animate-spin" /> : 
                         <div className="w-2 h-2 rounded-full bg-gray-200" />}
                      </div>
                      <div className="flex-1 pb-6">
                        <p className={`text-sm font-bold ${isPending ? 'text-gray-400' : 'text-gray-900'}`}>{s.name}</p>
                        <p className="text-[10px] text-gray-400 uppercase font-semibold">{s.step_type}</p>
                        {log && <p className="text-[10px] text-emerald-500 font-bold mt-1">Completed in {fmtDuration(log.started_at, log.ended_at)}</p>}
                        {isCurrent && <p className="text-[10px] text-blue-500 font-bold animate-pulse mt-1">Processing...</p>}
                      </div>
                    </div>
                    {i < steps.length - 1 && (
                      <div className={`absolute left-3 top-7 w-0.5 h-full -z-0 ${log ? 'bg-emerald-100' : 'bg-gray-100'}`} style={{ height: 'calc(100% - 32px)' }} />
                    )}
                  </React.Fragment>
                );
              })}
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
                <div className="bg-indigo-600 rounded-2xl shadow-xl p-8 text-white relative overflow-hidden animate-fadeIn">
                  <div className="absolute top-0 right-0 p-12 opacity-10"><Mail className="w-32 h-32" /></div>
                  <div className="relative z-10">
                    <h3 className="text-xl font-bold mb-4">Action Required</h3>
                    <div className="p-4 bg-white/10 backdrop-blur rounded-xl border border-white/20 mb-6 space-y-2">
                      <p className="text-sm font-medium">Waiting for approval at step: <span className="font-bold">{currentStepLog?.step_name}</span></p>
                      <p className="text-xs opacity-80">
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
                        <label className="block text-[10px] font-bold uppercase tracking-widest opacity-70 mb-1">Your ID (Optional)</label>
                        <input 
                          type="text" value={approverId} onChange={e => setApproverId(e.target.value)}
                          className="w-full bg-white/20 border-transparent focus:bg-white/30 rounded-lg px-3 py-2 text-sm placeholder:text-white/40"
                          placeholder="mgr_456"
                        />
                      </div>
                      <div className="flex gap-2 w-full sm:w-auto">
                        <button 
                          onClick={handleApprove} 
                          disabled={approving}
                          className="flex-1 sm:flex-none bg-emerald-400 hover:bg-emerald-500 text-emerald-900 font-bold px-6 py-2 rounded-lg transition shadow-lg disabled:opacity-50"
                        >
                          {approving ? '...' : '✅ Approve'}
                        </button>
                        <button 
                          onClick={handleReject} 
                          disabled={approving}
                          className="flex-1 sm:flex-none bg-red-400 hover:bg-red-500 text-red-900 font-bold px-6 py-2 rounded-lg transition shadow-lg disabled:opacity-50"
                        >
                          {approving ? '...' : '❌ Reject'}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Terminal Status Cards */}
            {execution?.status === 'completed' && (
              <div className="bg-emerald-50 border-2 border-emerald-200 rounded-2xl p-8 text-center animate-fadeIn">
                <div className="text-5xl mb-3">🎉</div>
                <h3 className="text-emerald-700 text-2xl font-bold">Workflow Completed!</h3>
                <p className="text-emerald-600 mt-2">All steps finished successfully in {fmtDuration(execution.started_at, execution.ended_at)}</p>
                <div className="mt-6 flex justify-center gap-3">
                  <button onClick={() => navigate('/audit')} className="bg-white border border-emerald-200 text-emerald-700 font-bold px-6 py-2 rounded-xl hover:bg-emerald-100 transition">View Audit Log</button>
                  <button onClick={() => navigate(`/workflows/${execution.workflow_id}/execute`)} className="bg-emerald-600 text-white font-bold px-6 py-2 rounded-xl hover:bg-emerald-700 transition">Execute Again</button>
                </div>
              </div>
            )}

            {execution?.status === 'canceled' && (
              <div className="bg-gray-50 border-2 border-gray-200 rounded-2xl p-8 text-center animate-fadeIn">
                <div className="text-5xl mb-3">⛔</div>
                <h3 className="text-gray-700 text-2xl font-bold">Execution Canceled</h3>
                <p className="text-gray-500 mt-2">This workflow was terminated before completion.</p>
                <button onClick={() => navigate('/audit')} className="mt-6 bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold px-8 py-2 rounded-xl transition">Back to Audit Log</button>
              </div>
            )}

            {execution?.status === 'failed' && (
              <div className="bg-red-50 border-2 border-red-200 rounded-2xl p-8 text-center animate-fadeIn">
                <div className="text-5xl mb-3">❌</div>
                <h3 className="text-red-700 text-2xl font-bold">Execution Failed</h3>
                <p className="text-red-600 mt-2 max-w-md mx-auto">{execution.error_message || 'An error occurred during execution.'}</p>
                <div className="mt-6 flex justify-center gap-3">
                  <button onClick={handleRetry} className="bg-red-600 hover:bg-red-700 text-white font-bold px-8 py-3 rounded-xl transition flex items-center gap-2 shadow-lg">
                    <RotateCcw className="w-5 h-5" /> Retry Execution
                  </button>
                </div>
              </div>
            )}

            {/* Logs List */}
            <div className="space-y-4">
              <h3 className="font-bold text-gray-900 ml-1">Execution Logs</h3>
              <div className="space-y-3">
                {logs.map((log, idx) => (
                  <div key={log.id} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                    <button 
                      onClick={() => toggleLog(log.id)}
                      className="w-full px-5 py-4 flex items-center justify-between hover:bg-gray-50 transition"
                    >
                      <div className="flex items-center gap-4">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${log.status === 'failed' ? 'bg-red-100 text-red-600' : 'bg-indigo-50 text-indigo-600'}`}>
                          <span className="text-xs font-bold">{idx + 1}</span>
                        </div>
                        <div className="text-left">
                          <p className="text-sm font-bold text-gray-900">{log.step_name}</p>
                          <p className="text-[10px] text-gray-400 font-medium uppercase">{log.step_type} • {fmtDuration(log.started_at, log.ended_at)}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <StatusBadge status={log.status} size="sm" />
                        {expandedLogs[log.id] ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                      </div>
                    </button>
                    
                    {expandedLogs[log.id] && (
                      <div className="px-5 pb-5 pt-2 border-t border-gray-50 bg-gray-50/30">
                        <div className="space-y-4">
                          <div>
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Rules Evaluated</p>
                            <div className="space-y-2">
                              {log.evaluated_rules?.map((r, ri) => (
                                <div key={ri} className={`flex items-start gap-3 p-2 rounded-lg border ${r.result ? 'bg-emerald-50 border-emerald-100 text-emerald-800' : 'bg-gray-50 border-gray-100 text-gray-500'}`}>
                                  {r.result ? <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 shrink-0" /> : <XCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />}
                                  <code className="text-xs font-mono flex-1 break-all">{r.rule}</code>
                                  <span className="text-[10px] font-bold uppercase">{r.result ? 'Match' : 'False'}</span>
                                </div>
                              ))}
                              {(!log.evaluated_rules || log.evaluated_rules.length === 0) && <p className="text-xs text-gray-400 italic py-2">No rules evaluated for this step type.</p>}
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-100 text-[11px]">
                            <div><p className="text-gray-400 font-bold uppercase mb-1">Duration</p><p className="text-gray-900 font-mono">{fmtDuration(log.started_at, log.ended_at)}</p></div>
                            <div><p className="text-gray-400 font-bold uppercase mb-1">Completed At</p><p className="text-gray-900 font-mono">{fmtTime(log.ended_at)}</p></div>
                            {log.selected_next_step && <div className="col-span-2"><p className="text-gray-400 font-bold uppercase mb-1">Selected Next Path</p><div className="flex items-center gap-2 text-indigo-600 font-bold"><ArrowRight className="w-3 h-3" /> {log.selected_next_step}</div></div>}
                            {log.error_message && <div className="col-span-2"><p className="text-red-400 font-bold uppercase mb-1">Error Message</p><p className="text-red-700 bg-red-50 p-2 rounded-lg border border-red-100 italic">{log.error_message}</p></div>}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>


      </div>
    );
  };

  if (loading) return <Layout title="Loading Execution..."><div className="animate-pulse space-y-6"><div className="h-40 bg-gray-100 rounded-2xl"/><div className="h-64 bg-gray-100 rounded-2xl"/></div></Layout>;

  if (!workflow && !execution) {
    return (
      <Layout title="Execute Workflow">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <p className="text-gray-500 text-lg">Workflow not found</p>
            <button onClick={() => navigate('/workflows')} className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition">Back to Workflows</button>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout title={execution ? 'Execution Detail' : 'Execute Workflow'}>
      <div className="max-w-6xl mx-auto pb-12">
        {/* Breadcrumb Context */}
        <div className="flex items-center gap-2 text-xs text-gray-500 mb-6 px-1">
          <span className="cursor-pointer hover:text-indigo-600" onClick={() => navigate('/workflows')}>Workflows</span>
          <ChevronRight className="w-3 h-3" />
          <span className="font-bold text-gray-900">{workflow?.name || 'Loading...'}</span>
          {execution && (
            <>
              <ChevronRight className="w-3 h-3" />
              <span className="text-gray-400 font-mono">{execution?.id?.substring(0,8)}</span>
            </>
          )}
        </div>

        {!execution ? renderInputForm() : renderProgress()}
      </div>
      
      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fadeIn { animation: fadeIn 0.4s ease-out; }
      `}</style>
    </Layout>
  );
}
