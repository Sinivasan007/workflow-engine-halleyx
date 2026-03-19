import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, ArrowRight, Save, Plus, Trash2, Edit2,
  Settings, Database, List, Check,
  Mail, Bell, Play, AlertTriangle
} from 'lucide-react';
import Layout from '../components/Layout';
import Modal from '../components/Modal';
import StatusBadge from '../components/StatusBadge';
import { useToast } from '../components/Toast';
import {
  getWorkflow, createWorkflow, updateWorkflow,
  createStep, updateStep, deleteStep,
  getRules, createRule, updateRule, deleteRule
} from '../services/api';

const STEP_TYPES = [
  {
    value: 'task', label: 'Task', emoji: '⚙️',
    desc: 'Automated or manual action (update database, report)',
    icon: Settings
  },
  {
    value: 'approval', label: 'Approval', emoji: '👋',
    desc: 'Pauses execution, waits for user to approve or reject',
    icon: Mail
  },
  {
    value: 'notification', label: 'Notification', emoji: '🔔',
    desc: 'Sends alert or message (email, Slack, UI)',
    icon: Bell
  },
];

/* ──────────────── Step Indicator ──────────────── */
function StepIndicator({ currentStep, steps }) {
  return (
    <div className="flex items-center justify-center mb-10">
      {steps.map((s, i) => {
        const isCompleted = i < currentStep;
        const isCurrent = i === currentStep;
        return (
          <React.Fragment key={i}>
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition-all duration-300 ${
                isCompleted
                  ? 'bg-emerald-600 text-white shadow-[0_4px_12px_rgba(16,185,129,0.3)]'
                  : isCurrent
                    ? 'bg-violet-600 text-white shadow-[0_4px_12px_rgba(124,58,237,0.3)]'
                    : 'bg-[#F3F0FF] text-[#9CA3AF] border border-[#E5E7EB]'
              }`}>
                {isCompleted ? <Check className="w-5 h-5" /> : i + 1}
              </div>
              <span className={`text-sm font-semibold hidden sm:block ${
                isCompleted ? 'text-emerald-600' : isCurrent ? 'text-[#111827]' : 'text-[#9CA3AF]'
              }`}>{s}</span>
            </div>
            {i < steps.length - 1 && (
              <div className={`w-16 h-0.5 mx-3 rounded transition-all duration-300 ${
                isCompleted ? 'bg-emerald-600' : 'bg-[#E5E7EB]'
              }`} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

export default function WorkflowEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const isEdit = !!id;

  const [loading, setLoading] = useState(isEdit);
  const [currentStep, setCurrentStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const WIZARD_STEPS = ['Workflow Details', 'Add Steps', 'Configure Rules'];

  // Workflow state
  const [workflow, setWorkflow] = useState({
    name: '', description: '', is_active: true,
    start_step_id: null, input_schema: [], steps: []
  });
  const [schemaFields, setSchemaFields] = useState([]);
  const [workflowId, setWorkflowId] = useState(id || null);

  // Step modal
  const initialStepForm = {
    name: '', step_type: 'task', step_order: 1,
    metadata: {
      assignee_email: '', instructions: '',
      channel: 'email', to: '', template: '',
      action: '', description: ''
    }
  };
  const [isStepModalOpen, setIsStepModalOpen] = useState(false);
  const [editingStep, setEditingStep] = useState(null);
  const [stepForm, setStepForm] = useState(initialStepForm);

  // Step 3 — Rules state
  const [rulesMap, setRulesMap] = useState({});
  const [expandedStep, setExpandedStep] = useState(null);
  const [editingRule, setEditingRule] = useState(null);
  const [ruleForm, setRuleForm] = useState({ priority: 1, condition_expr: '', next_step_id: '' });

  /* ── Schema helpers ──────────────────────────────────────── */
  const loadSchemaToArray = (schema) => {
    if (!schema) return [];
    if (Array.isArray(schema)) return schema;
    return Object.entries(schema).map(([name, config]) => ({
      id: Math.random(), name,
      type: config.type || 'string',
      required: config.required || false,
      allowed_values: Array.isArray(config.allowed_values)
        ? config.allowed_values.join(', ') : (config.allowed_values || '')
    }));
  };

  const buildSchemaObject = (fields) => {
    const obj = {};
    fields.forEach(f => {
      if (!f.name) return;
      obj[f.name] = {
        type: f.type, required: f.required,
        ...(f.allowed_values?.trim() && {
          allowed_values: f.allowed_values.split(',').map(v => v.trim()).filter(Boolean)
        })
      };
    });
    return obj;
  };

  /* ── Load data ──────────────────────────────────────── */
  const loadWorkflow = useCallback(async () => {
    try {
      const { data } = await getWorkflow(id);
      setWorkflow(prev => ({
        ...prev, ...data,
        steps: [...(data.steps || [])].sort((a, b) => a.step_order - b.step_order)
      }));
      setWorkflowId(data.id);
      const schema = typeof data.input_schema === 'string' ? JSON.parse(data.input_schema) : (data.input_schema || {});
      setSchemaFields(loadSchemaToArray(schema));
    } catch (err) {
      showToast('Failed to load workflow', 'error');
    }
  }, [id, showToast]);

  useEffect(() => {
    if (isEdit) {
      const load = async () => {
        try { await loadWorkflow(); } catch { navigate('/workflows'); }
        finally { setLoading(false); }
      };
      load();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, isEdit]);

  /* ── Load rules for Step 3 ──────────────────────────── */
  const loadRulesForSteps = useCallback(async () => {
    const steps = workflow.steps || [];
    const map = {};
    for (const s of steps) {
      try {
        const { data } = await getRules(s.id);
        map[s.id] = data;
      } catch { map[s.id] = []; }
    }
    setRulesMap(map);
    if (steps.length > 0 && !expandedStep) setExpandedStep(steps[0].id);
  }, [workflow.steps, expandedStep]);

  useEffect(() => {
    if (currentStep === 2 && workflow.steps?.length > 0) {
      loadRulesForSteps();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStep]);

  /* ── Schema management ──────────────────────────────── */
  const addSchemaField = () => {
    setSchemaFields(prev => [...prev, { id: Math.random(), name: '', type: 'string', required: false, allowed_values: '' }]);
  };
  const removeSchemaField = (fid) => setSchemaFields(prev => prev.filter(f => f.id !== fid));
  const updateSchemaField = (fid, field, value) => setSchemaFields(prev => prev.map(f => f.id === fid ? { ...f, [field]: value } : f));

  /* ── Step management ──────────────────────────────────── */
  const buildMetadata = () => {
    switch (stepForm.step_type) {
      case 'approval': return { assignee_email: stepForm.metadata.assignee_email || '', instructions: stepForm.metadata.instructions || '' };
      case 'notification': return { channel: stepForm.metadata.channel || 'email', to: stepForm.metadata.to || '', template: stepForm.metadata.template || '' };
      case 'task': return { action: stepForm.metadata.action || '', description: stepForm.metadata.description || '' };
      default: return {};
    }
  };

  const handleCloseModal = () => { setIsStepModalOpen(false); setEditingStep(null); setStepForm(initialStepForm); };

  const openAddStep = () => {
    setEditingStep(null);
    setStepForm({ ...initialStepForm, step_order: (workflow.steps?.length || 0) + 1 });
    setIsStepModalOpen(true);
  };

  const openEditStep = (step) => {
    const pm = typeof step.metadata === 'string' ? JSON.parse(step.metadata) : (step.metadata || {});
    setEditingStep(step);
    setStepForm({
      name: step.name || '', step_type: step.step_type || 'task',
      step_order: step.step_order || 1,
      metadata: {
        assignee_email: pm.assignee_email || '', instructions: pm.instructions || '',
        channel: pm.channel || 'email', to: pm.to || '', template: pm.template || '',
        action: pm.action || '', description: pm.description || ''
      }
    });
    setIsStepModalOpen(true);
  };

  const saveStep = async () => {
    if (!stepForm.name) return showToast('Step name is required', 'error');
    const payload = { name: stepForm.name, step_type: stepForm.step_type, step_order: stepForm.step_order, metadata: buildMetadata() };
    try {
      if (editingStep) {
        await updateStep(editingStep.id, payload);
        showToast('Step updated', 'success');
      } else {
        if (!workflowId) {
          if (!workflow.name) return showToast('Please name the workflow first', 'error');
          const { data } = await createWorkflow({ ...workflow, input_schema: buildSchemaObject(schemaFields) });
          setWorkflowId(data.id);
          setWorkflow(prev => ({ ...prev, id: data.id }));
          navigate(`/workflows/${data.id}/edit`, { replace: true });
          await createStep(data.id, payload);
        } else {
          await createStep(workflowId, payload);
        }
        showToast('Step added', 'success');
      }
      handleCloseModal();
      await loadWorkflow();
    } catch { showToast('Failed to save step', 'error'); }
  };

  const handleDeleteStep = async (stepId) => {
    if (!window.confirm('Delete this step?')) return;
    try { await deleteStep(stepId); showToast('Step deleted', 'success'); await loadWorkflow(); }
    catch { showToast('Failed to delete step', 'error'); }
  };

  /* ── Rule management ────────────────────────────────── */
  const handleSaveRule = async (stepId) => {
    if (!ruleForm.condition_expr) return showToast('Condition is required', 'error');
    const cleanNext = (!ruleForm.next_step_id || ruleForm.next_step_id === 'null' || ruleForm.next_step_id === '__END__') ? null : ruleForm.next_step_id;
    const payload = { ...ruleForm, next_step_id: cleanNext };
    try {
      if (editingRule) { await updateRule(editingRule.id, payload); showToast('Rule updated', 'success'); }
      else { await createRule(stepId, payload); showToast('Rule added', 'success'); }
      setEditingRule(null);
      setRuleForm({ priority: 1, condition_expr: '', next_step_id: '' });
      await loadRulesForSteps();
    } catch { showToast('Failed to save rule', 'error'); }
  };

  const handleDeleteRule = async (rid) => {
    if (!window.confirm('Delete this rule?')) return;
    try { await deleteRule(rid); showToast('Rule deleted', 'success'); await loadRulesForSteps(); }
    catch { showToast('Failed to delete rule', 'error'); }
  };

  const startEditRule = (rule) => {
    setEditingRule(rule);
    setRuleForm({ priority: rule.priority, condition_expr: rule.condition_expr, next_step_id: rule.next_step_id || '' });
  };

  /* ── Navigation ──────────────────────────────────────── */
  const handleNext = async () => {
    if (currentStep === 0) {
      if (!workflow.name) return showToast('Workflow name is required', 'error');
      // Auto-save workflow on step 1 completion for new workflows
      if (!workflowId) {
        try {
          const { data } = await createWorkflow({ name: workflow.name, description: workflow.description, is_active: workflow.is_active, input_schema: buildSchemaObject(schemaFields) });
          setWorkflowId(data.id);
          setWorkflow(prev => ({ ...prev, id: data.id, ...data, steps: data.steps || [] }));
          navigate(`/workflows/${data.id}/edit`, { replace: true });
          showToast('Workflow created', 'success');
        } catch { showToast('Failed to create workflow', 'error'); return; }
      } else {
        try {
          await updateWorkflow(workflowId, { name: workflow.name, description: workflow.description, is_active: workflow.is_active, input_schema: buildSchemaObject(schemaFields) });
        } catch { showToast('Failed to save details', 'error'); return; }
      }
    }
    setCurrentStep(prev => Math.min(prev + 1, 2));
  };

  const handleBack = () => setCurrentStep(prev => Math.max(prev - 1, 0));

  const handleFinalSave = async () => {
    setSaving(true);
    try {
      const firstStep = workflow.steps?.sort((a, b) => a.step_order - b.step_order)?.[0];
      await updateWorkflow(workflowId, {
        name: workflow.name, description: workflow.description, is_active: workflow.is_active,
        start_step_id: workflow.start_step_id || firstStep?.id || null,
        input_schema: buildSchemaObject(schemaFields)
      });
      showToast('🎉 Workflow saved successfully!', 'success');
      navigate('/workflows');
    } catch { showToast('Failed to save workflow', 'error'); }
    finally { setSaving(false); }
  };

  if (loading) return (
    <Layout title="Loading...">
      <div className="animate-pulse space-y-4">
        <div className="h-32 bg-[#E5E7EB] rounded-2xl" />
        <div className="h-64 bg-[#E5E7EB] rounded-2xl" />
      </div>
    </Layout>
  );

  /* ═══════════════════ RENDER ═══════════════════ */
  return (
    <Layout title={isEdit ? `Edit: ${workflow.name}` : 'New Workflow'}>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="max-w-4xl mx-auto">

        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-xs text-[#6B7280] mb-6">
          <span className="cursor-pointer hover:text-[#111827] transition" onClick={() => navigate('/workflows')}>Workflows</span>
          <span>›</span>
          <span className="text-[#111827] font-medium">{isEdit ? 'Edit Workflow' : 'Create Workflow'}</span>
          <span>›</span>
          <span className="text-violet-600 font-semibold">{WIZARD_STEPS[currentStep]}</span>
        </div>

        {/* Step Indicator */}
        <StepIndicator currentStep={currentStep} steps={WIZARD_STEPS} />

        {/* ═══ STEP 1: Workflow Details ═══ */}
        <AnimatePresence mode="wait">
          {currentStep === 0 && (
            <motion.div key="step1" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} className="space-y-6">
              <div className="bg-[#FFFFFF] border border-[#E5E7EB] rounded-2xl p-6 shadow-[0_4px_24px_rgba(0,0,0,0.06)]">
                <div className="flex items-center gap-2 mb-5 text-[#111827] font-bold">
                  <div className="w-8 h-8 rounded-xl bg-violet-100 flex items-center justify-center"><Settings className="w-4 h-4 text-violet-600" /></div>
                  <h3>Basic Information</h3>
                </div>
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-[#6B7280] uppercase tracking-wider mb-2">Workflow Name *</label>
                    <input type="text" value={workflow.name} onChange={e => setWorkflow({ ...workflow, name: e.target.value })}
                      className="w-full bg-[#F8F7FF] border border-[#E5E7EB] text-[#111827] text-xl font-bold rounded-xl px-4 py-3 placeholder-[#9CA3AF] focus:outline-none focus:border-violet-400 focus:shadow-[0_0_0_3px_rgba(124,58,237,0.08)] transition-all"
                      placeholder="e.g. Expense Approval" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-[#6B7280] uppercase tracking-wider mb-2">Description</label>
                    <textarea rows="3" value={workflow.description} onChange={e => setWorkflow({ ...workflow, description: e.target.value })}
                      className="w-full bg-[#F8F7FF] border border-[#E5E7EB] text-[#111827] rounded-xl px-4 py-3 placeholder-[#9CA3AF] focus:outline-none focus:border-violet-400 transition-all resize-none"
                      placeholder="Describe what this workflow does..." />
                  </div>
                  <div className="flex items-center justify-between p-4 bg-[#F8F7FF] rounded-xl border border-[#E5E7EB]">
                    <div className="text-sm"><p className="font-semibold text-[#111827]">Status</p><p className="text-[#6B7280] text-xs mt-0.5">Active workflows can be executed</p></div>
                    <button onClick={() => setWorkflow({ ...workflow, is_active: !workflow.is_active })}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${workflow.is_active ? 'bg-violet-600' : 'bg-[#E5E7EB]'}`}>
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${workflow.is_active ? 'translate-x-6' : 'translate-x-1'}`} />
                    </button>
                  </div>
                </div>
              </div>

              {/* Input Schema */}
              <div className="bg-[#FFFFFF] border border-[#E5E7EB] rounded-2xl p-6 shadow-[0_4px_24px_rgba(0,0,0,0.06)]">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2 text-[#111827] font-bold">
                    <div className="w-8 h-8 rounded-xl bg-purple-100 flex items-center justify-center"><Database className="w-4 h-4 text-purple-600" /></div>
                    <h3>Input Schema</h3>
                  </div>
                  <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.95 }} onClick={addSchemaField}
                    className="text-violet-600 hover:bg-violet-50 border border-violet-200 px-3 py-1.5 rounded-xl text-sm font-semibold flex items-center gap-1 transition-all">
                    <Plus className="w-4 h-4" /> Add Field
                  </motion.button>
                </div>
                <p className="text-sm text-[#6B7280] mb-4">Define the data this workflow accepts</p>
                <div className="space-y-2">
                  {schemaFields.map((field) => (
                    <motion.div key={field.id} initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="bg-[#F8F7FF] rounded-xl p-3 border border-[#E5E7EB]">
                      <div className="flex items-center gap-3">
                        <input type="text" value={field.name} onChange={e => updateSchemaField(field.id, 'name', e.target.value)}
                          className="flex-1 bg-transparent border-none text-[#111827] text-sm focus:outline-none placeholder-[#9CA3AF]" placeholder="Field name" />
                        <div className="flex gap-1">
                          {['string', 'number', 'boolean'].map(t => (
                            <button key={t} onClick={() => updateSchemaField(field.id, 'type', t)}
                              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${field.type === t ? 'bg-violet-600 text-white' : 'bg-[#FFFFFF] border border-[#E5E7EB] text-[#6B7280] hover:text-[#111827]'}`}>
                              {t.charAt(0).toUpperCase() + t.slice(1)}
                            </button>
                          ))}
                        </div>
                        <button onClick={() => updateSchemaField(field.id, 'required', !field.required)}
                          className={`px-2 py-1 rounded-lg text-xs font-medium transition-all ${field.required ? 'bg-red-50 text-red-600 border border-red-200' : 'bg-[#FFFFFF] border border-[#E5E7EB] text-[#6B7280]'}`}>Req</button>
                        {field.type === 'string' && (
                          <input type="text" value={field.allowed_values || ''} onChange={e => updateSchemaField(field.id, 'allowed_values', e.target.value)}
                            className="w-32 bg-[#FFFFFF] border border-[#E5E7EB] text-[#111827] text-xs rounded-lg px-2 py-1 placeholder-[#9CA3AF] focus:outline-none focus:border-violet-400"
                            placeholder="High, Med, Low" />
                        )}
                        <button onClick={() => removeSchemaField(field.id)} className="p-1 text-[#9CA3AF] hover:text-red-500 transition"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </motion.div>
                  ))}
                  {schemaFields.length === 0 && <div className="text-center py-6 text-[#6B7280] text-sm border border-dashed border-[#E5E7EB] rounded-xl">No input fields defined. Click "+ Add Field" to start.</div>}
                </div>
              </div>
            </motion.div>
          )}

          {/* ═══ STEP 2: Add Steps ═══ */}
          {currentStep === 1 && (
            <motion.div key="step2" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} className="space-y-6">
              <div className="bg-[#FFFFFF] border border-[#E5E7EB] rounded-2xl p-6 shadow-[0_4px_24px_rgba(0,0,0,0.06)]">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2 text-[#111827] font-bold">
                    <div className="w-8 h-8 rounded-xl bg-blue-100 flex items-center justify-center"><List className="w-4 h-4 text-blue-600" /></div>
                    <h3>Steps ({workflow.steps?.length || 0})</h3>
                  </div>
                  <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.95 }} onClick={openAddStep}
                    className="bg-violet-600 hover:bg-violet-500 text-white px-4 py-2 rounded-xl font-medium flex items-center gap-2 transition-all shadow-[0_4px_12px_rgba(124,58,237,0.3)] hover:shadow-[0_8px_20px_rgba(124,58,237,0.4)]">
                    <Plus className="w-4 h-4" /> Add Step
                  </motion.button>
                </div>
                <div className="space-y-3">
                  {workflow.steps?.length === 0 ? (
                    <div className="text-center py-14 border-2 border-dashed border-[#E5E7EB] rounded-2xl text-[#6B7280]">
                      <List className="w-12 h-12 mx-auto mb-3 text-[#D1D5DB]" />
                      <p className="font-medium text-[#111827]">No steps added yet</p>
                      <p className="text-sm mt-1">Click "+ Add Step" to design your workflow</p>
                    </div>
                  ) : (
                    workflow.steps?.sort((a, b) => a.step_order - b.step_order).map((step, idx) => (
                      <motion.div key={step.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: idx * 0.05 }}
                        className="group flex items-center gap-4 p-4 rounded-xl border border-[#E5E7EB] bg-[#F8F7FF] hover:border-violet-300 transition-all">
                        <div className="w-8 h-8 rounded-full bg-violet-600 text-white flex items-center justify-center font-bold text-sm shrink-0">{idx + 1}</div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-[#111827]">{step.name}</span>
                            <StatusBadge status={step.step_type} size="sm" />
                            {step.step_type === 'approval' && (() => {
                              const m = typeof step.metadata === 'string' ? JSON.parse(step.metadata) : (step.metadata || {});
                              return m.assignee_email ? <span className="text-xs text-violet-600/70">📧 {m.assignee_email}</span> : null;
                            })()}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-all">
                          <button onClick={() => openEditStep(step)} className="p-1.5 text-[#9CA3AF] hover:text-violet-600 hover:bg-violet-50 rounded-lg transition-all"><Edit2 className="w-4 h-4" /></button>
                          <button onClick={() => handleDeleteStep(step.id)} className="p-1.5 text-[#9CA3AF] hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      </motion.div>
                    ))
                  )}
                </div>
              </div>

              {/* Start Step Selector */}
              {workflow.steps?.length > 0 && (
                <div className="bg-[#FFFFFF] border border-[#E5E7EB] rounded-2xl p-6 shadow-[0_4px_24px_rgba(0,0,0,0.06)]">
                  <div className="flex items-center gap-2 mb-4 text-[#111827] font-bold">
                    <div className="w-8 h-8 rounded-xl bg-emerald-100 flex items-center justify-center"><Play className="w-4 h-4 text-emerald-600" /></div>
                    <h3>Start Step</h3>
                  </div>
                  <select value={workflow.start_step_id || ''} onChange={e => setWorkflow({ ...workflow, start_step_id: e.target.value || null })}
                    className="w-full bg-[#F8F7FF] border border-[#E5E7EB] text-[#111827] rounded-xl px-4 py-3 focus:outline-none focus:border-violet-400 transition-all">
                    <option value="">Select start step...</option>
                    {workflow.steps.sort((a, b) => a.step_order - b.step_order).map(s => (
                      <option key={s.id} value={s.id}>{s.step_order}. {s.name} ({s.step_type})</option>
                    ))}
                  </select>
                </div>
              )}
            </motion.div>
          )}

          {/* ═══ STEP 3: Configure Rules ═══ */}
          {currentStep === 2 && (
            <motion.div key="step3" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} className="space-y-6">
              {workflow.steps?.length === 0 ? (
                <div className="bg-[#FFFFFF] border border-[#E5E7EB] rounded-2xl p-12 text-center shadow-[0_4px_24px_rgba(0,0,0,0.06)]">
                  <AlertTriangle className="w-12 h-12 mx-auto mb-3 text-[#E5E7EB]" />
                  <p className="text-[#111827] font-medium">No steps to configure rules for</p>
                  <p className="text-[#6B7280] text-sm mt-1">Go back and add steps first</p>
                </div>
              ) : (
                workflow.steps?.sort((a, b) => a.step_order - b.step_order).map((step, idx) => {
                  const stepRules = (rulesMap[step.id] || []).sort((a, b) => a.priority - b.priority);
                  const isExpanded = expandedStep === step.id;
                  return (
                    <motion.div key={step.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.05 }}
                      className="bg-[#FFFFFF] border border-[#E5E7EB] rounded-2xl overflow-hidden shadow-[0_4px_24px_rgba(0,0,0,0.06)]">
                      <button onClick={() => setExpandedStep(isExpanded ? null : step.id)}
                        className="w-full px-6 py-4 flex items-center justify-between hover:bg-[#F8F7FF] transition-all">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-violet-600 text-white flex items-center justify-center font-bold text-sm">{idx + 1}</div>
                          <div className="text-left">
                            <p className="font-bold text-[#111827]">{step.name}</p>
                            <p className="text-[10px] text-[#6B7280] uppercase">{step.step_type} • {stepRules.length} rule{stepRules.length !== 1 ? 's' : ''}</p>
                          </div>
                        </div>
                        <div className={`transition-transform ${isExpanded ? 'rotate-180' : ''}`}>▾</div>
                      </button>

                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                            className="border-t border-[#E5E7EB]">
                            <div className="p-6 space-y-4">
                              {/* Existing rules */}
                              {stepRules.length > 0 ? stepRules.map((r) => {
                                const isDef = r.condition_expr.toUpperCase() === 'DEFAULT';
                                return (
                                  <div key={r.id} className={`flex items-center gap-4 p-3 rounded-xl border ${isDef ? 'bg-yellow-50 border-yellow-200' : 'bg-[#F8F7FF] border-[#E5E7EB]'}`}>
                                    <span className={`text-xs font-bold ${isDef ? 'text-yellow-600' : 'text-violet-600'}`}>{isDef ? 'DEF' : `P${r.priority}`}</span>
                                    <code className="text-sm font-mono text-[#4B5563] flex-1 truncate">{r.condition_expr}</code>
                                    <span className="text-xs text-violet-600">→ {workflow.steps.find(s => s.id === r.next_step_id)?.name || '🏁 End'}</span>
                                    <div className="flex gap-1">
                                      <button onClick={() => startEditRule(r)} className="p-1 text-[#9CA3AF] hover:text-violet-600 transition"><Edit2 className="w-3.5 h-3.5" /></button>
                                      <button onClick={() => handleDeleteRule(r.id)} className="p-1 text-[#9CA3AF] hover:text-red-500 transition"><Trash2 className="w-3.5 h-3.5" /></button>
                                    </div>
                                  </div>
                                );
                              }) : (
                                <p className="text-[#6B7280] text-sm italic">No rules yet. Add one below.</p>
                              )}

                              {/* Add/Edit rule form */}
                              <div className="bg-[#FFFFFF] rounded-xl p-4 border border-[#E5E7EB] space-y-3">
                                <p className="text-xs font-bold text-[#6B7280] uppercase">{editingRule ? 'Edit Rule' : 'Add Rule'}</p>
                                <input type="text" value={ruleForm.condition_expr} onChange={e => setRuleForm({ ...ruleForm, condition_expr: e.target.value })}
                                  className="w-full bg-[#F8F7FF] border border-[#E5E7EB] text-[#111827] rounded-xl px-4 py-2.5 font-mono text-sm placeholder-[#9CA3AF] focus:outline-none focus:border-violet-400 transition-all"
                                  placeholder="amount > 100 && country == 'US'" />
                                <div className="flex flex-wrap gap-1">
                                  {['==', '!=', '>', '<', '>=', '<=', '&&', '||', 'DEFAULT'].map(op => (
                                    <button key={op} onClick={() => setRuleForm(prev => ({ ...prev, condition_expr: prev.condition_expr + (prev.condition_expr ? ' ' : '') + op }))}
                                      className={`px-2 py-1 rounded-lg text-xs font-mono border ${op === 'DEFAULT' ? 'bg-yellow-50 border-yellow-200 text-yellow-700' : 'bg-[#F8F7FF] border-[#E5E7EB] text-violet-600 hover:bg-violet-50'} transition`}>
                                      {op}
                                    </button>
                                  ))}
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                  <input type="number" value={ruleForm.priority} onChange={e => setRuleForm({ ...ruleForm, priority: parseInt(e.target.value) || 1 })}
                                    className="bg-[#F8F7FF] border border-[#E5E7EB] text-[#111827] rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-violet-400 transition-all"
                                    placeholder="Priority" min="1" />
                                  <select value={ruleForm.next_step_id} onChange={e => setRuleForm({ ...ruleForm, next_step_id: e.target.value })}
                                    className="bg-[#F8F7FF] border border-[#E5E7EB] text-[#111827] rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-violet-400 transition-all">
                                    <option value="">Select next step...</option>
                                    <option value="__END__">🏁 End Workflow</option>
                                    {workflow.steps.filter(s => s.id !== step.id).map(s => (
                                      <option key={s.id} value={s.id}>{s.name} ({s.step_type})</option>
                                    ))}
                                  </select>
                                </div>
                                <div className="flex justify-end gap-2">
                                  {editingRule && (
                                    <button onClick={() => { setEditingRule(null); setRuleForm({ priority: 1, condition_expr: '', next_step_id: '' }); }}
                                      className="px-4 py-2 text-[#6B7280] hover:text-[#111827] text-sm rounded-xl transition">Cancel</button>
                                  )}
                                  <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.95 }} onClick={() => handleSaveRule(step.id)}
                                    className="bg-violet-600 hover:bg-violet-500 text-white px-5 py-2 rounded-xl text-sm font-semibold flex items-center gap-2 transition-all">
                                    <Save className="w-3.5 h-3.5" /> {editingRule ? 'Update' : 'Add Rule'}
                                  </motion.button>
                                </div>
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  );
                })
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* ═══ Navigation Buttons ═══ */}
        <div className="flex items-center justify-between mt-8">
          <div>
            {currentStep > 0 && (
              <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.95 }} onClick={handleBack}
                className="px-6 py-2.5 text-[#6B7280] hover:text-[#111827] hover:bg-[#F3F0FF] rounded-xl font-medium flex items-center gap-2 transition-all">
                <ArrowLeft className="w-4 h-4" /> Back
              </motion.button>
            )}
          </div>
          <div>
            {currentStep < 2 ? (
              <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.95 }} onClick={handleNext}
                className="bg-violet-600 hover:bg-violet-500 text-white px-8 py-2.5 rounded-xl font-medium flex items-center gap-2 transition-all shadow-[0_4px_12px_rgba(124,58,237,0.3)] hover:shadow-[0_8px_20px_rgba(124,58,237,0.4)]">
                Next <ArrowRight className="w-4 h-4" />
              </motion.button>
            ) : (
              <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.95 }} onClick={handleFinalSave} disabled={saving}
                className="bg-emerald-600 hover:bg-emerald-500 text-white px-8 py-2.5 rounded-xl font-bold flex items-center gap-2 transition-all shadow-[0_4px_12px_rgba(16,185,129,0.3)] hover:shadow-[0_8px_20px_rgba(16,185,129,0.4)] disabled:opacity-50">
                <Save className="w-4 h-4" /> {saving ? 'Saving...' : 'Save Workflow'}
              </motion.button>
            )}
          </div>
        </div>
      </motion.div>

      {/* ═══ ADD/EDIT STEP MODAL ═══ */}
      <Modal isOpen={isStepModalOpen} onClose={handleCloseModal} title={editingStep ? 'Edit Step' : 'Add New Step'} size="md">
        <div className="space-y-5 py-2">
          <div>
            <label className="block text-xs font-medium text-[#6B7280] uppercase tracking-wider mb-2">Step Name *</label>
            <input type="text" value={stepForm.name} onChange={e => setStepForm({ ...stepForm, name: e.target.value })}
              className="w-full bg-[#F8F7FF] border border-[#E5E7EB] text-[#111827] rounded-xl px-4 py-3 placeholder-[#9CA3AF] focus:outline-none focus:border-violet-400 transition-all"
              placeholder="e.g. Manager Approval" />
          </div>

          {/* Step Type Cards */}
          <div>
            <label className="block text-xs font-medium text-[#6B7280] uppercase tracking-wider mb-3">Step Type *</label>
            <div className="space-y-2">
              {STEP_TYPES.map(t => (
                <button key={t.value} onClick={() => setStepForm({ ...stepForm, step_type: t.value })}
                  className={`w-full text-left flex items-center gap-4 p-4 rounded-xl border transition-all ${
                    stepForm.step_type === t.value
                      ? 'border-violet-500 bg-violet-50 shadow-[0_2px_12px_rgba(124,58,237,0.1)]'
                      : 'border-[#E5E7EB] bg-[#F8F7FF] hover:border-violet-300'
                  }`}>
                  <span className="text-2xl">{t.emoji}</span>
                  <div className="flex-1">
                    <p className="font-bold text-[#111827] text-sm">{t.label}</p>
                    <p className="text-[#6B7280] text-xs mt-0.5">{t.desc}</p>
                  </div>
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                    stepForm.step_type === t.value ? 'border-violet-500 bg-violet-500' : 'border-[#E5E7EB]'
                  }`}>
                    {stepForm.step_type === t.value && <Check className="w-3 h-3 text-white" />}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Order */}
          <div>
            <label className="block text-xs font-medium text-[#6B7280] uppercase tracking-wider mb-2">Order</label>
            <input type="number" value={stepForm.step_order} onChange={e => setStepForm({ ...stepForm, step_order: parseInt(e.target.value) || 1 })}
              className="w-full bg-[#F8F7FF] border border-[#E5E7EB] text-[#111827] rounded-xl px-4 py-3 focus:outline-none focus:border-violet-400 transition-all" min="1" />
          </div>

          {/* Approval fields */}
          {stepForm.step_type === 'approval' && (
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl space-y-4">
              <div>
                <label className="block text-xs font-bold text-blue-600 uppercase tracking-wider mb-1">Approver Email *</label>
                <input type="email" value={stepForm.metadata.assignee_email || ''} onChange={e => setStepForm({ ...stepForm, metadata: { ...stepForm.metadata, assignee_email: e.target.value } })}
                  className="w-full bg-[#FFFFFF] border border-[#E5E7EB] text-[#111827] rounded-xl px-4 py-2.5 text-sm placeholder-[#9CA3AF] focus:outline-none focus:border-blue-400 transition-all"
                  placeholder="approver@example.com" />
                <p className="text-[10px] text-blue-500/80 mt-1.5">An approval email with Accept/Decline links will be sent to this address</p>
              </div>
              <div>
                <label className="block text-xs font-bold text-blue-600 uppercase tracking-wider mb-1">Instructions</label>
                <textarea rows="2" value={stepForm.metadata.instructions || ''} onChange={e => setStepForm({ ...stepForm, metadata: { ...stepForm.metadata, instructions: e.target.value } })}
                  className="w-full bg-[#FFFFFF] border border-[#E5E7EB] text-[#111827] rounded-xl px-4 py-2.5 text-sm placeholder-[#9CA3AF] focus:outline-none focus:border-blue-400 transition-all resize-none"
                  placeholder="Instructions for the approver" />
              </div>
            </div>
          )}

          {/* Notification fields */}
          {stepForm.step_type === 'notification' && (
            <div className="p-4 bg-purple-50 border border-purple-200 rounded-xl space-y-4">
              <div>
                <label className="block text-xs font-bold text-purple-600 uppercase tracking-wider mb-1">Channel</label>
                <div className="flex gap-1">
                  {['email', 'slack', 'ui'].map(ch => (
                    <button key={ch} onClick={() => setStepForm({ ...stepForm, metadata: { ...stepForm.metadata, channel: ch } })}
                      className={`px-4 py-2 rounded-xl text-xs font-medium transition-all ${
                        stepForm.metadata.channel === ch ? 'bg-purple-600 text-white' : 'bg-[#FFFFFF] text-[#6B7280] border border-[#E5E7EB] hover:text-[#111827]'
                      }`}>{ch === 'ui' ? 'UI Toast' : ch.charAt(0).toUpperCase() + ch.slice(1)}</button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-purple-600 uppercase tracking-wider mb-1">Recipient Email</label>
                <input type="text" value={stepForm.metadata.to || ''} onChange={e => setStepForm({ ...stepForm, metadata: { ...stepForm.metadata, to: e.target.value } })}
                  className="w-full bg-[#FFFFFF] border border-[#E5E7EB] text-[#111827] rounded-xl px-4 py-2.5 text-sm placeholder-[#9CA3AF] focus:outline-none focus:border-purple-400 transition-all"
                  placeholder="finance@company.com" />
              </div>
              <div>
                <label className="block text-xs font-bold text-purple-600 uppercase tracking-wider mb-1">Message Template</label>
                <textarea rows="2" value={stepForm.metadata.template || ''} onChange={e => setStepForm({ ...stepForm, metadata: { ...stepForm.metadata, template: e.target.value } })}
                  className="w-full bg-[#FFFFFF] border border-[#E5E7EB] text-[#111827] rounded-xl px-4 py-2.5 text-sm font-mono placeholder-[#9CA3AF] focus:outline-none focus:border-purple-400 transition-all resize-none"
                  placeholder='Hello {{user}}, your item is ready.' />
              </div>
            </div>
          )}

          {/* Task fields */}
          {stepForm.step_type === 'task' && (
            <div className="p-4 bg-orange-50 border border-orange-200 rounded-xl space-y-4">
              <div>
                <label className="block text-xs font-bold text-orange-600 uppercase tracking-wider mb-1">Action Name</label>
                <input type="text" value={stepForm.metadata.action || ''} onChange={e => setStepForm({ ...stepForm, metadata: { ...stepForm.metadata, action: e.target.value } })}
                  className="w-full bg-[#FFFFFF] border border-[#E5E7EB] text-[#111827] rounded-xl px-4 py-2.5 text-sm placeholder-[#9CA3AF] focus:outline-none focus:border-orange-400 transition-all"
                  placeholder="update_db_record" />
              </div>
              <div>
                <label className="block text-xs font-bold text-orange-600 uppercase tracking-wider mb-1">Description</label>
                <textarea rows="2" value={stepForm.metadata.description || ''} onChange={e => setStepForm({ ...stepForm, metadata: { ...stepForm.metadata, description: e.target.value } })}
                  className="w-full bg-[#FFFFFF] border border-[#E5E7EB] text-[#111827] rounded-xl px-4 py-2.5 text-sm placeholder-[#9CA3AF] focus:outline-none focus:border-orange-400 transition-all resize-none"
                  placeholder="Internal task details" />
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t border-[#E5E7EB]">
            <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.95 }} onClick={handleCloseModal}
              className="px-4 py-2.5 text-[#6B7280] hover:text-[#111827] hover:bg-[#F3F0FF] rounded-xl font-medium transition-all border border-transparent hover:border-[#E5E7EB]">Cancel</motion.button>
            <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.95 }} onClick={saveStep}
              className="bg-violet-600 hover:bg-violet-500 text-white px-6 py-2.5 rounded-xl font-medium flex items-center gap-2 transition-all shadow-[0_4px_12px_rgba(124,58,237,0.3)] hover:shadow-[0_8px_20px_rgba(124,58,237,0.4)]">
              <Save className="w-4 h-4" /> {editingStep ? 'Update Step' : 'Add Step'}
            </motion.button>
          </div>
        </div>
      </Modal>
    </Layout>
  );
}
