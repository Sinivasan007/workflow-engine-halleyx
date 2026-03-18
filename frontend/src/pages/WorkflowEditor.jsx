import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  ArrowLeft, Save, Plus, Trash2, Edit2, 
  Settings, Database, List, Eye, Trash,
  Mail, Bell, Play, CheckCircle2
} from 'lucide-react';
import Layout from '../components/Layout';
import Modal from '../components/Modal';
import StatusBadge from '../components/StatusBadge';
import { useToast } from '../components/Toast';
import { 
  getWorkflow, createWorkflow, updateWorkflow,
  createStep, updateStep, deleteStep 
} from '../services/api';

const STEP_TYPES = [
  { value: 'task', label: 'Task', icon: Settings },
  { value: 'approval', label: 'Approval', icon: Mail },
  { value: 'notification', label: 'Notification', icon: Bell },
];

export default function WorkflowEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const isEdit = !!id;

  const [loading, setLoading] = useState(isEdit);
  const [isDirty, setIsDirty] = useState(false);

  // Workflow Basic Info
  const [workflow, setWorkflow] = useState({
    name: '',
    description: '',
    is_active: true,
    start_step_id: null,
    input_schema: [],
    steps: []
  });

  // Step Modal State
  const initialStepForm = {
    name: '',
    step_type: 'task',
    step_order: 1,
    metadata: {
      assignee_email: '',
      instructions: '',
      channel: 'email',
      to: '',
      template: '',
      action: '',
      description: ''
    }
  };
  const [isStepModalOpen, setIsStepModalOpen] = useState(false);
  const [editingStep, setEditingStep] = useState(null);
  const [stepForm, setStepForm] = useState(initialStepForm);

  // Input Schema State (Array for UI)
  const [schemaFields, setSchemaFields] = useState([]);

  // Convert object -> array for UI
  const loadSchemaToArray = (schema) => {
    if (!schema) return [];
    if (Array.isArray(schema)) return schema;
    return Object.entries(schema).map(([name, config]) => ({
      id: Math.random(),
      name,
      type: config.type || 'string',
      required: config.required || false,
      allowed_values: Array.isArray(config.allowed_values)
        ? config.allowed_values.join(', ')
        : (config.allowed_values || '')
    }));
  };

  // Convert array -> object for API
  const buildSchemaObject = (fields) => {
    const obj = {};
    fields.forEach(f => {
      if (!f.name) return;
      obj[f.name] = {
        type: f.type,
        required: f.required,
        ...(f.allowed_values?.trim() && {
          allowed_values: f.allowed_values.split(',').map(v => v.trim()).filter(Boolean)
        })
      };
    });
    return obj;
  };

  /* ── Load Data ───────────────────────────────────────────────────────── */
  const loadWorkflow = async () => {
    try {
      const { data } = await getWorkflow(id);
      setWorkflow(prev => ({
        ...prev,
        ...data,
        steps: [...(data.steps || [])].sort((a, b) => a.step_order - b.step_order)
      }));
      const schema = typeof data.input_schema === 'string' ? JSON.parse(data.input_schema) : (data.input_schema || {});
      setSchemaFields(loadSchemaToArray(schema));
    } catch (err) {
      console.error('Failed to load workflow', err);
      showToast('Failed to load workflow', 'error');
    }
  };

  useEffect(() => {
    if (isEdit) {
      const load = async () => {
        try {
          await loadWorkflow();
        } catch {
          navigate('/workflows');
        } finally {
          setLoading(false);
        }
      };
      load();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, isEdit]);

  /* ── Input Schema Management ─────────────────────────────────────────── */
  const addSchemaField = () => {
    setSchemaFields(prev => [...prev, { id: Math.random(), name: '', type: 'string', required: false, allowed_values: '' }]);
    setIsDirty(true);
  };

  const removeSchemaField = (id) => {
    setSchemaFields(prev => prev.filter(f => f.id !== id));
    setIsDirty(true);
  };

  const updateSchemaField = (id, field, value) => {
    setSchemaFields(prev => prev.map(f => f.id === id ? { ...f, [field]: value } : f));
    setIsDirty(true);
  };

  /* ── Step Management ─────────────────────────────────────────────────── */
  const buildMetadata = () => {
    switch (stepForm.step_type) {
      case 'approval':
        return {
          assignee_email: stepForm.metadata.assignee_email || '',
          instructions: stepForm.metadata.instructions || ''
        };
      case 'notification':
        return {
          channel: stepForm.metadata.channel || 'email',
          to: stepForm.metadata.to || '',
          template: stepForm.metadata.template || ''
        };
      case 'task':
        return {
          action: stepForm.metadata.action || '',
          description: stepForm.metadata.description || ''
        };
      default:
        return {};
    }
  };

  const handleCloseModal = () => {
    setIsStepModalOpen(false);
    setEditingStep(null);
    setStepForm(initialStepForm);
  };

  const openAddStep = () => {
    setEditingStep(null);
    setStepForm({
      ...initialStepForm,
      step_order: (workflow.steps?.length || 0) + 1
    });
    setIsStepModalOpen(true);
  };

  const openEditStep = (step) => {
    const parsedMetadata = typeof step.metadata === 'string'
      ? JSON.parse(step.metadata)
      : (step.metadata || {});
    setEditingStep(step);
    setStepForm({
      name: step.name || '',
      step_type: step.step_type || 'task',
      step_order: step.step_order || 1,
      metadata: {
        assignee_email: parsedMetadata.assignee_email || '',
        instructions: parsedMetadata.instructions || '',
        channel: parsedMetadata.channel || 'email',
        to: parsedMetadata.to || '',
        template: parsedMetadata.template || '',
        action: parsedMetadata.action || '',
        description: parsedMetadata.description || ''
      }
    });
    setIsStepModalOpen(true);
  };

  const saveStep = async () => {
    if (!stepForm.name) return showToast('Step name is required', 'error');

    const payload = {
      name: stepForm.name,
      step_type: stepForm.step_type,
      step_order: stepForm.step_order,
      metadata: buildMetadata()
    };

    try {
      if (editingStep) {
        await updateStep(editingStep.id, payload);
        showToast('Step updated', 'success');
      } else {
        if (!isEdit) {
          if (!workflow.name) return showToast('Please name the workflow first', 'error');
          const { data } = await createWorkflow({ ...workflow, input_schema: JSON.stringify(workflow.input_schema) });
          setWorkflow(prev => ({ ...prev, id: data.id }));
          navigate(`/workflows/${data.id}/edit`, { replace: true });
          await createStep(data.id, payload);
        } else {
          await createStep(id, payload);
        }
        showToast('Step added', 'success');
      }
      handleCloseModal();
      await loadWorkflow();
    } catch {
      showToast('Failed to save step', 'error');
    }
  };

  const handleDeleteStep = async (stepId) => {
    if (!window.confirm('Delete this step?')) return;
    try {
      await deleteStep(stepId);
      showToast('Step deleted', 'success');
      await loadWorkflow();
    } catch {
      showToast('Failed to delete step', 'error');
    }
  };

  /* ── Save Workflow ───────────────────────────────────────────────────── */
  const handleSaveWorkflow = async () => {
    if (!workflow.name) return showToast('Workflow name is required', 'error');
    
    const payload = {
      name: workflow.name,
      description: workflow.description,
      is_active: workflow.is_active,
      start_step_id: workflow.start_step_id || null,
      input_schema: buildSchemaObject(schemaFields)
    };
    
    try {
      if (isEdit) {
        await updateWorkflow(id, payload);
        showToast('Workflow saved', 'success');
      } else {
        await createWorkflow(payload);
        showToast('Workflow created', 'success');
      }
      setIsDirty(false);
      navigate('/workflows');
    } catch {
      showToast('Failed to save workflow', 'error');
    }
  };

  if (loading) return (
    <Layout title="Loading...">
      <div className="animate-pulse space-y-4">
        <div className="h-32 bg-[#1A1A35] rounded-2xl"/>
        <div className="h-64 bg-[#1A1A35] rounded-2xl"/>
      </div>
    </Layout>
  );

  return (
    <Layout title={isEdit ? `Edit: ${workflow.name}` : 'New Workflow'}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex flex-col gap-6"
      >
        
        {/* Header Actions */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate('/workflows')} className="p-2 hover:bg-[#1A1A35] rounded-lg text-[#64748B] transition">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h2 className="text-2xl font-bold text-white">{isEdit ? 'Edit Workflow' : 'Create New Workflow'}</h2>
              {isDirty && <span className="text-amber-400 text-xs font-medium">● Unsaved changes</span>}
            </div>
          </div>
          <div className="flex gap-3">
            <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.95 }}
              onClick={() => navigate('/workflows')} 
              className="px-4 py-2.5 text-[#94A3B8] hover:text-white hover:bg-[#1A1A35] rounded-xl font-medium transition-all"
            >
              Cancel
            </motion.button>
            <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.95 }}
              onClick={handleSaveWorkflow} 
              className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-2.5 rounded-xl font-medium flex items-center gap-2 transition-all hover:shadow-[0_0_20px_rgba(99,102,241,0.4)]"
            >
              <Save className="w-4 h-4" /> Save Workflow
            </motion.button>
          </div>
        </div>

        <div className="grid grid-cols-12 gap-8 items-start">
          
          {/* ── LEFT COLUMN: Editor ────────────────────────────────────── */}
          <div className="col-span-12 lg:col-span-8 space-y-6">
            
            {/* Section 1: Basic Info */}
            <div className="bg-[#141428] border border-[#2D2D5E] rounded-2xl p-6">
              <div className="flex items-center gap-2 mb-4 text-white font-bold">
                <div className="w-8 h-8 rounded-xl bg-indigo-500/20 flex items-center justify-center">
                  <Settings className="w-4 h-4 text-indigo-400" />
                </div>
                <h3>Basic Information</h3>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-[#94A3B8] uppercase tracking-wider mb-2">Workflow Name *</label>
                  <input 
                    type="text" 
                    value={workflow.name} 
                    onChange={e => { setWorkflow({...workflow, name: e.target.value}); setIsDirty(true); }}
                    className="w-full bg-[#0A0A14] border border-[#2D2D5E] text-white text-xl font-bold rounded-xl px-4 py-3 placeholder-[#64748B] focus:outline-none focus:border-indigo-500 focus:shadow-[0_0_0_3px_rgba(99,102,241,0.1)] transition-all"
                    placeholder="e.g. Expense Approval"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#94A3B8] uppercase tracking-wider mb-2">Description</label>
                  <textarea 
                    rows="3"
                    value={workflow.description}
                    onChange={e => { setWorkflow({...workflow, description: e.target.value}); setIsDirty(true); }}
                    className="w-full bg-[#0A0A14] border border-[#2D2D5E] text-white rounded-xl px-4 py-3 placeholder-[#64748B] focus:outline-none focus:border-indigo-500 focus:shadow-[0_0_0_3px_rgba(99,102,241,0.1)] transition-all resize-none"
                    placeholder="Describe what this workflow does..."
                  />
                </div>
                <div className="flex items-center justify-between p-4 bg-[#0A0A14] rounded-xl border border-[#2D2D5E]">
                  <div className="text-sm">
                    <p className="font-semibold text-white">Status</p>
                    <p className="text-[#64748B] text-xs mt-0.5">Active workflows can be executed by users</p>
                  </div>
                  <button 
                    onClick={() => { setWorkflow({...workflow, is_active: !workflow.is_active}); setIsDirty(true); }}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${workflow.is_active ? 'bg-indigo-600' : 'bg-[#2D2D5E]'}`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${workflow.is_active ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                </div>
              </div>
            </div>

            {/* Section 1.5: Start Step */}
            {isEdit && (
              <div className="bg-[#141428] border border-[#2D2D5E] rounded-2xl p-6">
                <div className="flex items-center gap-2 mb-4 text-white font-bold">
                  <div className="w-8 h-8 rounded-xl bg-green-500/20 flex items-center justify-center">
                    <Play className="w-4 h-4 text-green-400" />
                  </div>
                  <h3>Start Step</h3>
                </div>
                <p className="text-sm text-[#94A3B8] mb-4">Select which step the workflow should begin with when executed.</p>
                {workflow.steps?.length > 0 ? (
                  <div className="space-y-3">
                    <select
                      value={workflow.start_step_id || ''}
                      onChange={e => { setWorkflow({...workflow, start_step_id: e.target.value || null}); setIsDirty(true); }}
                      className="w-full bg-[#0A0A14] border border-[#2D2D5E] text-white rounded-xl px-4 py-3 focus:outline-none focus:border-indigo-500 transition-all"
                    >
                      <option value="">Select start step...</option>
                      {workflow.steps.sort((a,b) => a.step_order - b.step_order).map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.step_order}. {s.name} ({s.step_type})
                        </option>
                      ))}
                    </select>
                    {workflow.start_step_id && (() => {
                      const selected = workflow.steps.find(s => String(s.id) === String(workflow.start_step_id));
                      return selected ? (
                        <div className="flex items-center gap-2 p-3 bg-green-500/10 rounded-xl border border-green-500/30">
                          <CheckCircle2 className="w-4 h-4 text-green-400" />
                          <span className="text-sm font-medium text-green-400">Start: {selected.name}</span>
                          <span className="text-xs text-green-400/70 capitalize">({selected.step_type})</span>
                        </div>
                      ) : null;
                    })()}
                  </div>
                ) : (
                  <div className="p-4 bg-[#0A0A14] rounded-xl text-center text-[#64748B] text-sm border border-[#2D2D5E]">
                    Add steps first to set start step
                  </div>
                )}
              </div>
            )}

            {/* Section 2: Input Schema */}
            <div className="bg-[#141428] border border-[#2D2D5E] rounded-2xl p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2 text-white font-bold">
                  <div className="w-8 h-8 rounded-xl bg-purple-500/20 flex items-center justify-center">
                    <Database className="w-4 h-4 text-purple-400" />
                  </div>
                  <h3>Input Schema</h3>
                </div>
                <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.95 }}
                  onClick={addSchemaField}
                  className="text-indigo-400 hover:bg-indigo-500/10 border border-indigo-500/30 px-3 py-1.5 rounded-xl text-sm font-semibold flex items-center gap-1 transition-all"
                >
                  <Plus className="w-4 h-4" /> Add Field
                </motion.button>
              </div>
              <p className="text-sm text-[#94A3B8] mb-4">Define the data this workflow accepts</p>
              
              <div className="space-y-2">
                {schemaFields.map((field) => (
                  <motion.div 
                    key={field.id}
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-[#0A0A14] rounded-xl p-3 border border-[#2D2D5E]"
                  >
                    <div className="flex items-center gap-3">
                      <input 
                        type="text" value={field.name}
                        onChange={e => updateSchemaField(field.id, 'name', e.target.value)}
                        className="flex-1 bg-transparent border-none text-white text-sm focus:outline-none placeholder-[#64748B]"
                        placeholder="Field name"
                      />
                      <div className="flex gap-1">
                        {['string', 'number', 'boolean'].map(t => (
                          <button
                            key={t}
                            onClick={() => updateSchemaField(field.id, 'type', t)}
                            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                              field.type === t 
                                ? 'bg-indigo-600 text-white' 
                                : 'bg-[#1A1A35] text-[#64748B] hover:text-white'
                            }`}
                          >
                            {t.charAt(0).toUpperCase() + t.slice(1)}
                          </button>
                        ))}
                      </div>
                      <button
                        onClick={() => updateSchemaField(field.id, 'required', !field.required)}
                        className={`px-2 py-1 rounded-lg text-xs font-medium transition-all ${
                          field.required ? 'bg-red-500/10 text-red-400 border border-red-500/30' : 'bg-[#1A1A35] text-[#64748B]'
                        }`}
                      >
                        Req
                      </button>
                      {field.type === 'string' && (
                        <input 
                          type="text" value={field.allowed_values || ''}
                          onChange={e => updateSchemaField(field.id, 'allowed_values', e.target.value)}
                          className="w-32 bg-[#1A1A35] border border-[#2D2D5E] text-white text-xs rounded-lg px-2 py-1 placeholder-[#64748B] focus:outline-none focus:border-indigo-500"
                          placeholder="High, Med, Low"
                        />
                      )}
                      <button onClick={() => removeSchemaField(field.id)} className="p-1 text-[#64748B] hover:text-red-400 transition">
                        <Trash className="w-4 h-4" />
                      </button>
                    </div>
                  </motion.div>
                ))}
                {schemaFields.length === 0 && (
                  <div className="text-center py-6 text-[#64748B] text-sm border border-dashed border-[#2D2D5E] rounded-xl">
                    No input fields defined. Click "+ Add Field" to start.
                  </div>
                )}
              </div>
            </div>

            {/* Section 3: Steps */}
            <div className="bg-[#141428] border border-[#2D2D5E] rounded-2xl p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2 text-white font-bold">
                  <div className="w-8 h-8 rounded-xl bg-blue-500/20 flex items-center justify-center">
                    <List className="w-4 h-4 text-blue-400" />
                  </div>
                  <h3>Steps</h3>
                </div>
                <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.95 }}
                  onClick={openAddStep}
                  className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-xl font-medium flex items-center gap-2 transition-all hover:shadow-[0_0_20px_rgba(99,102,241,0.4)]"
                >
                  <Plus className="w-4 h-4" /> Add Step
                </motion.button>
              </div>

              <div className="space-y-3">
                {workflow.steps?.length === 0 ? (
                  <div className="text-center py-10 border-2 border-dashed border-[#2D2D5E] rounded-2xl text-[#64748B]">
                    No steps added yet
                  </div>
                ) : (
                  workflow.steps?.sort((a,b) => a.step_order - b.step_order).map((step, idx) => (
                    <motion.div 
                      key={step.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.05 }}
                      className="group flex items-center gap-4 p-4 rounded-xl border border-[#2D2D5E] bg-[#0A0A14] hover:border-[#6366F1]/50 transition-all"
                    >
                      <div className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-sm shrink-0">
                        {idx + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-white">{step.name}</span>
                          <StatusBadge status={step.step_type} size="sm" />
                          {String(step.id) === String(workflow.start_step_id) && (
                            <span className="bg-green-500/10 text-green-400 border border-green-500/30 text-xs rounded-full px-2 py-0.5 font-medium">
                              ▶ START
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-all">
                        <Link 
                          to={`/workflows/${id}/steps/${step.id}/rules`}
                          className="px-3 py-1.5 text-xs font-semibold text-indigo-400 border border-indigo-500/30 hover:bg-indigo-500/10 rounded-lg transition-all"
                        >
                          📋 Edit Rules
                        </Link>
                        <button onClick={() => openEditStep(step)} className="p-1.5 text-[#64748B] hover:text-indigo-400 hover:bg-indigo-500/10 rounded-lg transition-all">
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleDeleteStep(step.id)} className="p-1.5 text-[#64748B] hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </motion.div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* ── RIGHT COLUMN: Preview ───────────────────────────────────── */}
          <div className="col-span-12 lg:col-span-4 sticky top-24">
            <div className="bg-[#141428] border border-[#2D2D5E] rounded-2xl overflow-hidden">
              <div className="bg-[#0A0A14] px-6 py-4 border-b border-[#2D2D5E] flex items-center gap-2">
                <Eye className="w-5 h-5 text-[#64748B]" />
                <h3 className="font-bold text-white">👁 Live Preview</h3>
              </div>
              <div className="p-6 space-y-6">
                <div>
                  <h4 className="text-xl font-bold text-white">{workflow.name || 'Untitled Workflow'}</h4>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-xs bg-indigo-500/10 text-indigo-400 border border-indigo-500/30 rounded-full px-2 py-0.5 font-medium">
                      v{workflow.version || 1}
                    </span>
                    <span className={`inline-flex items-center gap-1 text-xs rounded-full px-2 py-0.5 font-medium ${
                      workflow.is_active 
                        ? 'bg-green-500/10 text-green-400 border border-green-500/30' 
                        : 'bg-gray-500/10 text-gray-400 border border-gray-500/30'
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${workflow.is_active ? 'bg-green-400' : 'bg-gray-400'}`} />
                      {workflow.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                </div>

                <div>
                  <h5 className="text-xs font-bold text-[#64748B] uppercase tracking-widest mb-3 flex items-center gap-2">
                    Input Fields ({schemaFields.length})
                    <div className="h-px bg-[#2D2D5E] flex-1"/>
                  </h5>
                  <ul className="space-y-1.5">
                    {schemaFields.map((f) => (
                      <li key={f.id} className="text-sm flex items-center gap-2 bg-[#0A0A14] rounded-lg px-3 py-2">
                        <span className="font-medium text-white">{f.name || 'field_name'}</span>
                        <span className="text-[#64748B] text-xs font-mono">({f.type})</span>
                        {f.required && <span className="text-red-400 text-xs">*</span>}
                      </li>
                    ))}
                    {schemaFields.length === 0 && <li className="text-sm text-[#64748B] italic">No inputs defined</li>}
                  </ul>
                </div>

                <div>
                  <h5 className="text-xs font-bold text-[#64748B] uppercase tracking-widest mb-4 flex items-center gap-2">
                    Visual Flow ({workflow.steps?.length || 0})
                    <div className="h-px bg-[#2D2D5E] flex-1"/>
                  </h5>
                  <div className="space-y-0.5 ml-2">
                    {workflow.steps?.sort((a,b) => a.step_order - b.step_order).map((s, i, arr) => (
                      <React.Fragment key={s.id}>
                        <div className={`flex items-center gap-3 bg-[#0A0A14] rounded-xl p-3 border ${
                          String(s.id) === String(workflow.start_step_id) 
                            ? 'border-green-500/30' 
                            : 'border-[#2D2D5E]'
                        }`}>
                          <div className={`w-8 h-8 rounded-full border-2 border-indigo-500 flex items-center justify-center font-bold text-xs ${
                            String(s.id) === String(workflow.start_step_id) ? 'bg-green-500/20 text-green-400 border-green-500' : 'text-indigo-400'
                          }`}>
                            {String(s.id) === String(workflow.start_step_id) ? '▶' : (i + 1)}
                          </div>
                          <div className="flex-1 text-sm min-w-0">
                            <p className="font-bold text-white leading-tight truncate">{s.name}</p>
                            <p className="text-[10px] text-[#64748B] uppercase">{s.step_type}</p>
                          </div>
                        </div>
                        {i < arr.length - 1 && (
                          <div className="ml-6 h-4 w-px bg-indigo-500/30" />
                        )}
                      </React.Fragment>
                    ))}
                    {(!workflow.steps || workflow.steps.length === 0) && <p className="text-sm text-[#64748B] italic">No steps to show</p>}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* ── STEP MODAL ─────────────────────────────────────────────────── */}
      <Modal 
        isOpen={isStepModalOpen} 
        onClose={handleCloseModal} 
        title={editingStep ? 'Edit Step' : 'Add New Step'}
        size="md"
      >
        <div className="space-y-4 py-2">
          <div>
            <label className="block text-xs font-medium text-[#94A3B8] uppercase tracking-wider mb-2">Step Name *</label>
            <input 
              type="text" value={stepForm.name} 
              onChange={e => setStepForm({...stepForm, name: e.target.value})}
              className="w-full bg-[#0A0A14] border border-[#2D2D5E] text-white rounded-xl px-4 py-3 placeholder-[#64748B] focus:outline-none focus:border-indigo-500 transition-all"
              placeholder="e.g. Manager Approval"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-[#94A3B8] uppercase tracking-wider mb-2">Step Type *</label>
              <div className="flex gap-1">
                {STEP_TYPES.map(t => (
                  <button
                    key={t.value}
                    onClick={() => setStepForm({...stepForm, step_type: t.value})}
                    className={`flex-1 px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                      stepForm.step_type === t.value
                        ? 'bg-indigo-600 text-white'
                        : 'bg-[#0A0A14] text-[#64748B] border border-[#2D2D5E] hover:text-white'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-[#94A3B8] uppercase tracking-wider mb-2">Order</label>
              <input 
                type="number" value={stepForm.step_order}
                onChange={e => setStepForm({...stepForm, step_order: parseInt(e.target.value) || 1})}
                className="w-full bg-[#0A0A14] border border-[#2D2D5E] text-white rounded-xl px-4 py-3 focus:outline-none focus:border-indigo-500 transition-all"
                min="1"
              />
            </div>
          </div>

          {/* Approval type fields */}
          {stepForm.step_type === 'approval' && (
            <div className="p-4 bg-blue-500/5 border border-blue-500/20 rounded-xl space-y-4">
              <div>
                <label className="block text-xs font-bold text-blue-400 uppercase tracking-wider mb-1">Assignee Email</label>
                <input 
                  type="email" value={stepForm.metadata.assignee_email || ''}
                  onChange={e => setStepForm({...stepForm, metadata: {...stepForm.metadata, assignee_email: e.target.value}})}
                  className="w-full bg-[#0A0A14] border border-[#2D2D5E] text-white rounded-xl px-4 py-2.5 text-sm placeholder-[#64748B] focus:outline-none focus:border-blue-500 transition-all"
                  placeholder="approver@company.com"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-blue-400 uppercase tracking-wider mb-1">Instructions</label>
                <textarea 
                  rows="2" value={stepForm.metadata.instructions || ''}
                  onChange={e => setStepForm({...stepForm, metadata: {...stepForm.metadata, instructions: e.target.value}})}
                  className="w-full bg-[#0A0A14] border border-[#2D2D5E] text-white rounded-xl px-4 py-2.5 text-sm placeholder-[#64748B] focus:outline-none focus:border-blue-500 transition-all resize-none"
                  placeholder="Instructions for the approver"
                />
              </div>
            </div>
          )}

          {/* Notification type fields */}
          {stepForm.step_type === 'notification' && (
            <div className="p-4 bg-purple-500/5 border border-purple-500/20 rounded-xl space-y-4">
              <div>
                <label className="block text-xs font-bold text-purple-400 uppercase tracking-wider mb-1">Channel</label>
                <div className="flex gap-1">
                  {['email', 'slack', 'ui'].map(ch => (
                    <button key={ch}
                      onClick={() => setStepForm({...stepForm, metadata: {...stepForm.metadata, channel: ch}})}
                      className={`px-4 py-2 rounded-xl text-xs font-medium transition-all ${
                        stepForm.metadata.channel === ch
                          ? 'bg-purple-600 text-white'
                          : 'bg-[#0A0A14] text-[#64748B] border border-[#2D2D5E] hover:text-white'
                      }`}
                    >
                      {ch === 'ui' ? 'UI Toast' : ch.charAt(0).toUpperCase() + ch.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-purple-400 uppercase tracking-wider mb-1">Recipient</label>
                <input 
                  type="text" value={stepForm.metadata.to || ''}
                  onChange={e => setStepForm({...stepForm, metadata: {...stepForm.metadata, to: e.target.value}})}
                  className="w-full bg-[#0A0A14] border border-[#2D2D5E] text-white rounded-xl px-4 py-2.5 text-sm placeholder-[#64748B] focus:outline-none focus:border-purple-500 transition-all"
                  placeholder="finance@company.com"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-purple-400 uppercase tracking-wider mb-1">Template</label>
                <textarea 
                  rows="2" value={stepForm.metadata.template || ''}
                  onChange={e => setStepForm({...stepForm, metadata: {...stepForm.metadata, template: e.target.value}})}
                  className="w-full bg-[#0A0A14] border border-[#2D2D5E] text-white rounded-xl px-4 py-2.5 text-sm font-mono placeholder-[#64748B] focus:outline-none focus:border-purple-500 transition-all resize-none"
                  placeholder="Hello {{user}}, your item is ready."
                />
                <span className="text-[10px] text-[#64748B] mt-1 block">Use {"{{field}}"} for dynamic data infusion.</span>
              </div>
            </div>
          )}

          {/* Task type fields */}
          {stepForm.step_type === 'task' && (
            <div className="p-4 bg-orange-500/5 border border-orange-500/20 rounded-xl space-y-4">
              <div>
                <label className="block text-xs font-bold text-orange-400 uppercase tracking-wider mb-1">Action Identifier</label>
                <input 
                  type="text" value={stepForm.metadata.action || ''}
                  onChange={e => setStepForm({...stepForm, metadata: {...stepForm.metadata, action: e.target.value}})}
                  className="w-full bg-[#0A0A14] border border-[#2D2D5E] text-white rounded-xl px-4 py-2.5 text-sm placeholder-[#64748B] focus:outline-none focus:border-orange-500 transition-all"
                  placeholder="update_db_record"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-orange-400 uppercase tracking-wider mb-1">Description</label>
                <textarea 
                  rows="2" value={stepForm.metadata.description || ''}
                  onChange={e => setStepForm({...stepForm, metadata: {...stepForm.metadata, description: e.target.value}})}
                  className="w-full bg-[#0A0A14] border border-[#2D2D5E] text-white rounded-xl px-4 py-2.5 text-sm placeholder-[#64748B] focus:outline-none focus:border-orange-500 transition-all resize-none"
                  placeholder="Internal task details"
                />
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t border-[#2D2D5E]">
            <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.95 }}
              onClick={handleCloseModal}
              className="px-4 py-2.5 text-[#94A3B8] hover:text-white hover:bg-[#1A1A35] rounded-xl font-medium transition-all"
            >
              Cancel
            </motion.button>
            <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.95 }}
              onClick={saveStep}
              className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-2.5 rounded-xl font-medium flex items-center gap-2 transition-all hover:shadow-[0_0_20px_rgba(99,102,241,0.4)]"
            >
              <Save className="w-4 h-4" /> Save Step
            </motion.button>
          </div>
        </div>
      </Modal>

    </Layout>
  );
}
