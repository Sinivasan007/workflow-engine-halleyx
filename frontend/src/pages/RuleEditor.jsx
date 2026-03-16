import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { 
  Plus, Trash2, Edit2, ChevronRight,
  AlertTriangle, Lightbulb, Settings, Save, X, Info
} from 'lucide-react';
import Layout from '../components/Layout';
import { useToast } from '../components/Toast';
import { 
  getWorkflow, getRules, createRule, 
  updateRule, deleteRule 
} from '../services/api';

export default function RuleEditor() {
  const { id, stepId } = useParams();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [workflow, setWorkflow] = useState(null);
  const [step, setStep] = useState(null);
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);

  // Form state
  const [editingRule, setEditingRule] = useState(null);
  const [ruleForm, setRuleForm] = useState({
    priority: 1,
    condition_expr: '',
    next_step_id: ''
  });

  const loadData = useCallback(async () => {
    try {
      const [{ data: wf }, { data: rs }] = await Promise.all([
        getWorkflow(id),
        getRules(stepId)
      ]);
      setWorkflow(wf);
      setRules(rs);
      
      const currentStep = wf.steps?.find(s => s.id === stepId);
      setStep(currentStep);
    } catch {
      showToast('Failed to load rules', 'error');
    } finally {
      setLoading(false);
    }
  }, [id, stepId, showToast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSaveRule = async (e) => {
    e.preventDefault();
    if (!ruleForm.condition_expr) return showToast('Condition is required', 'error');
    if (!ruleForm.next_step_id) return showToast('Next step selection is required', 'error');

    try {
      if (editingRule) {
        await updateRule(editingRule.id, ruleForm);
        showToast('Rule updated', 'success');
      } else {
        await createRule(stepId, ruleForm);
        showToast('Rule added', 'success');
      }
      setEditingRule(null);
      setRuleForm({ priority: rules.length + 2, condition_expr: '', next_step_id: '' });
      loadData();
    } catch {
      showToast('Failed to save rule', 'error');
    }
  };

  const startEdit = (rule) => {
    setEditingRule(rule);
    setRuleForm({
      priority: rule.priority,
      condition_expr: rule.condition_expr,
      next_step_id: rule.next_step_id || ''
    });
  };

  const handleDeleteRule = async (rid) => {
    if (!window.confirm('Delete this rule?')) return;
    try {
      await deleteRule(rid);
      showToast('Rule deleted', 'success');
      loadData();
    } catch {
      showToast('Failed to delete rule', 'error');
    }
  };

  const hasDefault = rules.some(r => r.condition_expr.toUpperCase() === 'DEFAULT');

  if (loading) return <Layout title="Loading Rules..."><div className="animate-pulse h-64 bg-gray-100 rounded-2xl"/></Layout>;

  return (
    <Layout title="Rule Editor">
      <div className="max-w-5xl mx-auto space-y-6">
        
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
          <Link to="/workflows" className="hover:text-indigo-600 transition">Workflows</Link>
          <ChevronRight className="w-4 h-4" />
          <Link to={`/workflows/${id}/edit`} className="hover:text-indigo-600 transition truncate max-w-[150px]">{workflow?.name}</Link>
          <ChevronRight className="w-4 h-4" />
          <span className="text-gray-900 font-medium">{step?.name}</span>
          <ChevronRight className="w-4 h-4" />
          <span className="text-gray-900 font-medium">Rules</span>
        </div>

        {/* Step Info Banner */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-600">
              <Settings className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">{step?.name}</h2>
              <div className="flex items-center gap-3 mt-1 text-sm">
                <span className="text-gray-500 capitalize">Type: <strong className="text-gray-700">{step?.step_type}</strong></span>
                <span className="w-1 h-1 rounded-full bg-gray-300" />
                <span className="text-gray-500">Workflow: <strong className="text-gray-700">{workflow?.name}</strong></span>
              </div>
            </div>
          </div>
          <button onClick={() => navigate(`/workflows/${id}/edit`)} className="p-2 hover:bg-gray-100 rounded-lg text-gray-400">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Default Rule Warning */}
        {!hasDefault && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-500 mt-0.5" />
            <div>
              <h4 className="text-sm font-bold text-amber-800">No DEFAULT rule found!</h4>
              <p className="text-sm text-amber-700">Add a rule with condition <code className="bg-amber-100 px-1 rounded font-bold">DEFAULT</code> to handle unmatched scenarios and prevent execution failure.</p>
            </div>
          </div>
        )}

        {/* Rules Table */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-xs font-bold text-gray-500 uppercase tracking-wider border-b border-gray-100">
                <th className="px-6 py-4 text-left w-24">Priority</th>
                <th className="px-6 py-4 text-left">Condition</th>
                <th className="px-6 py-4 text-left">Next Step</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {rules.sort((a,b) => a.priority - b.priority).map((r) => {
                const isDef = r.condition_expr.toUpperCase() === 'DEFAULT';
                return (
                  <tr key={r.id} className={`${isDef ? 'bg-amber-50/50' : 'hover:bg-gray-50'} transition-colors`}>
                    <td className="px-6 py-4">
                      {isDef ? <span className="text-amber-600 font-bold">DEFAULT</span> : <span className="px-2 py-0.5 bg-gray-100 rounded-lg font-mono">{r.priority}</span>}
                    </td>
                    <td className="px-6 py-4 font-mono text-indigo-600 font-medium">
                      {r.condition_expr}
                    </td>
                    <td className="px-6 py-4 font-medium text-gray-700">
                      {workflow?.steps?.find(s => s.id === r.next_step_id)?.name || <span className="text-red-500 italic">End Workflow</span>}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-1">
                        <button onClick={() => startEdit(r)} className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition">
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleDeleteRule(r.id)} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {rules.length === 0 && (
                <tr>
                  <td colSpan="4" className="px-6 py-12 text-center">
                    <div className="flex flex-col items-center justify-center text-gray-400">
                      <AlertTriangle className="w-10 h-10 mb-2 opacity-20" />
                      <p className="font-medium">No rules defined for this step yet.</p>
                      <p className="text-xs">Add one below to handle flow logic.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Add/Edit Rule Card */}
        <div className="grid grid-cols-12 gap-8">
          <div className="col-span-12 lg:col-span-8">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2">
                {editingRule ? <Edit2 className="w-5 h-5 text-indigo-600" /> : <Plus className="w-5 h-5 text-indigo-600" />}
                {editingRule ? 'Edit Existing Rule' : 'Add New Rule'}
              </h3>
              
              <form onSubmit={handleSaveRule} className="space-y-6">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1.5">Condition Expression *</label>
                  <input 
                    type="text"
                    value={ruleForm.condition_expr}
                    onChange={e => setRuleForm({...ruleForm, condition_expr: e.target.value})}
                    className="w-full border border-gray-300 rounded-lg px-4 py-3 font-mono text-indigo-600 focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
                    placeholder="amount > 100 && country == 'US'"
                  />
                  <div className="mt-2 text-xs text-gray-500 flex items-center gap-4">
                    <span>Operators: <code className="bg-gray-100 px-1 rounded">==</code> <code className="bg-gray-100 px-1 rounded">!=</code> <code className="bg-gray-100 px-1 rounded">&&</code> <code className="bg-gray-100 px-1 rounded">||</code></span>
                    <span>Reserved: <code className="bg-amber-100 text-amber-600 px-1 rounded font-bold">DEFAULT</code></span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1.5">Priority</label>
                    <input 
                      type="number"
                      value={ruleForm.priority}
                      onChange={e => setRuleForm({...ruleForm, priority: parseInt(e.target.value)})}
                      className="w-full border border-gray-300 rounded-lg px-4 py-2"
                      placeholder="1"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-gray-700 mb-1.5">Next Step *</label>
                    <select 
                      value={ruleForm.next_step_id}
                      onChange={e => setRuleForm({...ruleForm, next_step_id: e.target.value})}
                      className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="">Select a step...</option>
                      {workflow?.steps?.filter(s => s.id !== stepId).map(s => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                      <option value="null" className="text-gray-400 italic">— End Workflow —</option>
                    </select>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-50">
                  {editingRule && (
                    <button 
                      type="button" 
                      onClick={() => { setEditingRule(null); setRuleForm({ priority: rules.length+1, condition_expr: '', next_step_id: '' }); }}
                      className="px-6 py-2 text-gray-500 hover:text-gray-700 font-medium"
                    >
                      Cancel
                    </button>
                  )}
                  <button 
                    type="submit"
                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-2 rounded-lg font-bold flex items-center gap-2 shadow-sm transition"
                  >
                    <Save className="w-4 h-4" />
                    {editingRule ? 'Update Rule' : 'Add Rule'}
                  </button>
                </div>
              </form>
            </div>
          </div>

          <div className="col-span-12 lg:col-span-4">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4">
              <h4 className="font-bold text-gray-900 flex items-center gap-2">
                <Lightbulb className="w-5 h-5 text-amber-400" />
                Language Syntax
              </h4>
              <div className="space-y-3">
                {[
                  { op: '== != > <', desc: 'Standard comparisons' },
                  { op: '&& ||', desc: 'Logical AND/OR' },
                  { op: 'contains(f, "v")', desc: 'String search' },
                  { op: 'startsWith(f, "v")', desc: 'Matches start' },
                  { op: 'DEFAULT', desc: 'Fall-through handler' },
                ].map((item, i) => (
                  <div key={i} className="flex flex-col p-2 bg-gray-50 rounded-lg hover:bg-gray-100 transition">
                    <code className="text-xs font-bold text-indigo-600">{item.op}</code>
                    <span className="text-[11px] text-gray-500 mt-0.5">{item.desc}</span>
                  </div>
                ))}
              </div>
              <div className="p-3 bg-blue-50 rounded-xl flex gap-3 text-xs text-blue-700 border border-blue-100">
                <Info className="w-4 h-4 shrink-0 mt-0.5" />
                <p>Rules are evaluated in ascending order of priority. The first match wins.</p>
              </div>
            </div>
          </div>
        </div>

      </div>
    </Layout>
  );
}
