import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { 
  ArrowLeft, Save, Plus, Trash2, Edit2, 
  Settings, Database, List, Eye, Trash,
  Mail, Bell, Play, CheckCircle2
} from 'lucide-react';
import Layout from '../components/Layout';
import Modal from '../components/Modal';
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
      id: Math.random(), // Unique ID for keying
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

  if (loading) return <Layout title="Loading..."><div className="animate-pulse space-y-4"><div className="h-32 bg-gray-200 rounded-2xl"/><div className="h-64 bg-gray-200 rounded-2xl"/></div></Layout>;

  return (
    <Layout title={isEdit ? `Edit: ${workflow.name}` : 'New Workflow'}>
      <div className="flex flex-col gap-6">
        
        {/* Header Actions */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate('/workflows')} className="p-2 hover:bg-gray-100 rounded-lg text-gray-500 transition">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">{isEdit ? 'Edit Workflow' : 'Create New Workflow'}</h2>
              {isDirty && <span className="text-amber-500 text-xs font-medium">• Unsaved changes</span>}
            </div>
          </div>
          <div className="flex gap-3">
            <button onClick={() => navigate('/workflows')} className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg font-medium transition">
              Cancel
            </button>
            <button onClick={handleSaveWorkflow} className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-lg font-medium flex items-center gap-2 shadow-sm transition">
              <Save className="w-4 h-4" /> Save Workflow
            </button>
          </div>
        </div>

        <div className="grid grid-cols-12 gap-8 items-start">
          
          {/* ── LEFT COLUMN: Editor ────────────────────────────────────── */}
          <div className="col-span-12 lg:col-span-8 space-y-6">
            
            {/* Section 1: Basic Info */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <div className="flex items-center gap-2 mb-4 text-gray-900 font-bold">
                <Settings className="w-5 h-5 text-indigo-600" />
                <h3>Basic Information</h3>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Workflow Name *</label>
                  <input 
                    type="text" 
                    value={workflow.name} 
                    onChange={e => { setWorkflow({...workflow, name: e.target.value}); setIsDirty(true); }}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
                    placeholder="e.g. Expense Approval"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <textarea 
                    rows="3"
                    value={workflow.description}
                    onChange={e => { setWorkflow({...workflow, description: e.target.value}); setIsDirty(true); }}
                    className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
                    placeholder="Describe what this workflow does..."
                  />
                </div>
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                  <div className="text-sm">
                    <p className="font-semibold text-gray-900">Status</p>
                    <p className="text-gray-500">Active workflows can be executed by users</p>
                  </div>
                  <button 
                    onClick={() => { setWorkflow({...workflow, is_active: !workflow.is_active}); setIsDirty(true); }}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${workflow.is_active ? 'bg-indigo-600' : 'bg-gray-200'}`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${workflow.is_active ? 'translate-x-6' : 'translate-x-1'}`} />
                  </button>
                </div>
              </div>
            </div>

            {/* Section 1.5: Start Step */}
            {isEdit && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                <div className="flex items-center gap-2 mb-4 text-gray-900 font-bold">
                  <Play className="w-5 h-5 text-indigo-600" />
                  <h3>Start Step</h3>
                </div>
                <p className="text-sm text-gray-500 mb-4">Select which step the workflow should begin with when executed.</p>
                {workflow.steps?.length > 0 ? (
                  <div className="space-y-3">
                    <select
                      value={workflow.start_step_id || ''}
                      onChange={e => { setWorkflow({...workflow, start_step_id: e.target.value || null}); setIsDirty(true); }}
                      className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
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
                        <div className="flex items-center gap-2 p-3 bg-emerald-50 rounded-xl border border-emerald-100">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          <span className="text-sm font-medium text-emerald-700">Start: {selected.name}</span>
                          <span className="text-xs text-emerald-500 capitalize">({selected.step_type})</span>
                        </div>
                      ) : null;
                    })()}
                  </div>
                ) : (
                  <div className="p-4 bg-gray-50 rounded-xl text-center text-gray-400 text-sm">
                    Add steps first to set start step
                  </div>
                )}
              </div>
            )}

            {/* Section 2: Input Schema */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2 text-gray-900 font-bold">
                  <Database className="w-5 h-5 text-indigo-600" />
                  <h3>Input Schema</h3>
                </div>
                <button 
                  onClick={addSchemaField}
                  className="text-indigo-600 hover:bg-indigo-50 px-3 py-1.5 rounded-lg text-sm font-semibold flex items-center gap-1 transition"
                >
                  <Plus className="w-4 h-4" /> Add Field
                </button>
              </div>
              <p className="text-sm text-gray-500 mb-4">Define the data this workflow accepts</p>
              
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-500 border-b border-gray-100 pb-2">
                      <th className="font-semibold py-2">Field Name</th>
                      <th className="font-semibold py-2">Type</th>
                      <th className="font-semibold py-2 text-center">Req</th>
                      <th className="font-semibold py-2">Allowed Values (CSV)</th>
                      <th className="font-semibold py-2 text-right"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {schemaFields.map((field) => (
                      <tr key={field.id}>
                        <td className="py-2 pr-2">
                          <input 
                            type="text" value={field.name}
                            onChange={e => updateSchemaField(field.id, 'name', e.target.value)}
                            className="w-full bg-gray-50 border-transparent focus:bg-white focus:border-indigo-500 rounded px-2 py-1 transition"
                            placeholder="e.g. amount"
                          />
                        </td>
                        <td className="py-2 pr-2">
                          <select 
                            value={field.type}
                            onChange={e => updateSchemaField(field.id, 'type', e.target.value)}
                            className="bg-gray-50 border-transparent focus:bg-white focus:border-indigo-500 rounded px-1 py-1"
                          >
                            <option value="string">String</option>
                            <option value="number">Number</option>
                            <option value="boolean">Boolean</option>
                          </select>
                        </td>
                        <td className="py-2 text-center">
                          <input 
                            type="checkbox" checked={field.required}
                            onChange={e => updateSchemaField(field.id, 'required', e.target.checked)}
                            className="rounded text-indigo-600 focus:ring-indigo-500"
                          />
                        </td>
                        <td className="py-2 pr-2">
                          <input 
                            type="text" value={field.allowed_values || ''}
                            onChange={e => updateSchemaField(field.id, 'allowed_values', e.target.value)}
                            className="w-full bg-gray-50 border-transparent focus:bg-white focus:border-indigo-500 rounded px-2 py-1"
                            placeholder="High, Med, Low"
                            disabled={field.type !== 'string'}
                          />
                        </td>
                        <td className="py-2 text-right">
                          <button onClick={() => removeSchemaField(field.id)} className="text-gray-400 hover:text-red-500 p-1">
                            <Trash className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {workflow.input_schema.length === 0 && <div className="text-center py-4 text-gray-400 italic">No input fields defined.</div>}
            </div>

            {/* Section 3: Steps */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2 text-gray-900 font-bold">
                  <List className="w-5 h-5 text-indigo-600" />
                  <h3>Steps</h3>
                </div>
                <button 
                  onClick={openAddStep}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition"
                >
                  <Plus className="w-4 h-4" /> Add Step
                </button>
              </div>

              <div className="space-y-3">
                {workflow.steps?.length === 0 ? (
                  <div className="text-center py-8 border-2 border-dashed border-gray-100 rounded-2xl text-gray-400">
                    No steps added yet
                  </div>
                ) : (
                  workflow.steps?.sort((a,b) => a.step_order - b.step_order).map((step, idx) => (
                    <div key={step.id} className="group flex items-center gap-4 p-4 rounded-xl border border-gray-100 hover:border-indigo-200 hover:bg-indigo-50/30 transition">
                      <div className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-sm shrink-0">
                        {idx + 1}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-gray-900">{step.name}</span>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                            step.step_type === 'approval' ? 'bg-blue-100 text-blue-700' :
                            step.step_type === 'notification' ? 'bg-purple-100 text-purple-700' :
                            'bg-orange-100 text-orange-700'
                          }`}>
                            {step.step_type}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 truncate max-w-xs">{JSON.stringify(typeof step.metadata === 'string' ? JSON.parse(step.metadata) : step.metadata)}</p>
                      </div>
                      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition">
                        <Link 
                          to={`/workflows/${id}/steps/${step.id}/rules`}
                          className="px-3 py-1 text-xs font-semibold text-indigo-600 border border-indigo-200 hover:bg-indigo-100 rounded-lg transition"
                        >
                          Edit Rules
                        </Link>
                        <button onClick={() => openEditStep(step)} className="p-1.5 text-gray-400 hover:text-indigo-600">
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleDeleteStep(step.id)} className="p-1.5 text-gray-400 hover:text-red-500">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* ── RIGHT COLUMN: Preview ───────────────────────────────────── */}
          <div className="col-span-12 lg:col-span-4 sticky top-24">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="bg-gray-50 px-6 py-4 border-b border-gray-100 flex items-center gap-2">
                <Eye className="w-5 h-5 text-gray-400" />
                <h3 className="font-bold text-gray-900">Live Preview</h3>
              </div>
              <div className="p-6 space-y-6">
                <div>
                  <h4 className="text-lg font-bold text-indigo-600">{workflow.name || 'Untitled Workflow'}</h4>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-gray-400 font-medium uppercase">Version {workflow.version || 1}</span>
                    <span className={`w-2 h-2 rounded-full ${workflow.status === 'active' ? 'bg-emerald-500' : 'bg-gray-300'}`} />
                    <span className="text-xs text-gray-500 capitalize">{workflow.status}</span>
                  </div>
                </div>

                <div>
                  <h5 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 overflow-hidden flex items-center gap-2">
                    Input Fields ({schemaFields.length})
                    <div className="h-px bg-gray-100 flex-1"/>
                  </h5>
                  <ul className="space-y-1.5">
                    {schemaFields.map((f) => (
                      <li key={f.id} className="text-sm text-gray-700 flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-indigo-200" />
                        <span className="font-medium">{f.name || 'field_name'}</span>
                        <span className="text-gray-400 text-xs font-mono">({f.type})</span>
                        {f.required && <span className="text-red-500 text-xs">*</span>}
                      </li>
                    ))}
                    {schemaFields.length === 0 && <li className="text-sm text-gray-400 italic">No inputs defined</li>}
                  </ul>
                </div>

                <div>
                  <h5 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4 overflow-hidden flex items-center gap-2">
                    Visual Flow ({workflow.steps?.length || 0})
                    <div className="h-px bg-gray-100 flex-1"/>
                  </h5>
                  <div className="space-y-0.5 ml-2">
                    {workflow.steps?.sort((a,b) => a.step_order - b.step_order).map((s, i, arr) => (
                      <React.Fragment key={s.id}>
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full border-2 border-indigo-600 flex items-center justify-center font-bold text-xs ${i === arr.length - 1 ? 'bg-indigo-600 text-white' : 'text-indigo-600'}`}>
                            {i === arr.length - 1 ? '■' : '●'}
                          </div>
                          <div className="flex-1 text-sm">
                            <p className="font-bold text-gray-900 leading-tight">{s.name}</p>
                            <p className="text-[10px] text-gray-400 uppercase">{s.step_type}</p>
                          </div>
                        </div>
                        {i < arr.length - 1 && (
                          <div className="ml-4 h-6 w-px bg-indigo-200" />
                        )}
                      </React.Fragment>
                    ))}
                    {(!workflow.steps || workflow.steps.length === 0) && <p className="text-sm text-gray-400 italic">No steps to show</p>}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── STEP MODAL ─────────────────────────────────────────────────── */}
      <Modal 
        isOpen={isStepModalOpen} 
        onClose={handleCloseModal} 
        title={editingStep ? 'Edit Step' : 'Add New Step'}
        size="md"
      >
        <div className="space-y-4 py-2">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Step Name *</label>
            <input 
              type="text" value={stepForm.name} 
              onChange={e => setStepForm({...stepForm, name: e.target.value})}
              className="w-full border border-gray-300 rounded-lg px-4 py-2"
              placeholder="e.g. Manager Approval"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Step Type *</label>
              <select 
                value={stepForm.step_type}
                onChange={e => setStepForm({...stepForm, step_type: e.target.value})}
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
              >
                {STEP_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Order Index</label>
              <input 
                type="number" value={stepForm.step_order}
                onChange={e => setStepForm({...stepForm, step_order: parseInt(e.target.value) || 1})}
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
                min="1"
              />
            </div>
          </div>

          <div className="p-4 bg-gray-50 rounded-xl space-y-4">
            {stepForm.step_type === 'approval' && (
              <>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Assignee Email</label>
                  <input 
                    type="email" value={stepForm.metadata.assignee_email || ''}
                    onChange={e => setStepForm({...stepForm, metadata: {...stepForm.metadata, assignee_email: e.target.value}})}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                    placeholder="approver@company.com"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Instructions</label>
                  <textarea 
                    rows="2" value={stepForm.metadata.instructions || ''}
                    onChange={e => setStepForm({...stepForm, metadata: {...stepForm.metadata, instructions: e.target.value}})}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                    placeholder="Instructions for the approver"
                  />
                </div>
              </>
            )}

            {stepForm.step_type === 'notification' && (
              <>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Channel</label>
                  <select 
                    value={stepForm.metadata.channel || 'email'}
                    onChange={e => setStepForm({...stepForm, metadata: {...stepForm.metadata, channel: e.target.value}})}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                  >
                    <option value="email">Email</option>
                    <option value="slack">Slack</option>
                    <option value="ui">UI Toast</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Recipient (Email/ID)</label>
                  <input 
                    type="text" value={stepForm.metadata.to || ''}
                    onChange={e => setStepForm({...stepForm, metadata: {...stepForm.metadata, to: e.target.value}})}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                    placeholder="finance@company.com"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Template</label>
                  <textarea 
                    rows="2" value={stepForm.metadata.template || ''}
                    onChange={e => setStepForm({...stepForm, metadata: {...stepForm.metadata, template: e.target.value}})}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono"
                    placeholder="Hello {{user}}, your item is ready."
                  />
                  <span className="text-[10px] text-gray-400 mt-1 block">Use {"{{field}}"} for dynamic data infusion.</span>
                </div>
              </>
            )}

            {stepForm.step_type === 'task' && (
              <>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Action Identifier</label>
                  <input 
                    type="text" value={stepForm.metadata.action || ''}
                    onChange={e => setStepForm({...stepForm, metadata: {...stepForm.metadata, action: e.target.value}})}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                    placeholder="update_db_record"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Description</label>
                  <textarea 
                    rows="2" value={stepForm.metadata.description || ''}
                    onChange={e => setStepForm({...stepForm, metadata: {...stepForm.metadata, description: e.target.value}})}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
                    placeholder="Internal task details"
                  />
                </div>
              </>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
            <button
              onClick={handleCloseModal}
              className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg font-medium transition"
            >
              Cancel
            </button>
            <button
              onClick={saveStep}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-lg font-medium flex items-center gap-2 transition"
            >
              <Save className="w-4 h-4" /> Save Step
            </button>
          </div>
        </div>
      </Modal>

    </Layout>
  );
}
