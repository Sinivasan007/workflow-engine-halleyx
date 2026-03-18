import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  Plus, Trash2, Edit2, ChevronRight,
  AlertTriangle, Lightbulb, Settings, Save, X, Info
} from 'lucide-react';
import Layout from '../components/Layout';
import StatusBadge from '../components/StatusBadge';
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

    const cleanNextStepId = (!ruleForm.next_step_id || ruleForm.next_step_id === 'null' || ruleForm.next_step_id === '__END__')
      ? null
      : ruleForm.next_step_id;

    const payload = {
      ...ruleForm,
      next_step_id: cleanNextStepId,
    };

    try {
      if (editingRule) {
        await updateRule(editingRule.id, payload);
        showToast('Rule updated', 'success');
      } else {
        await createRule(stepId, payload);
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

  const appendToCondition = (op) => {
    setRuleForm(prev => ({ ...prev, condition_expr: prev.condition_expr + (prev.condition_expr ? ' ' : '') + op }));
  };

  const hasDefault = rules.some(r => r.condition_expr.toUpperCase() === 'DEFAULT');

  if (loading) return (
    <Layout title="Loading Rules...">
      <div className="animate-pulse space-y-4">
        <div className="h-20 bg-[#1A1A35] rounded-2xl"/>
        <div className="h-64 bg-[#1A1A35] rounded-2xl"/>
      </div>
    </Layout>
  );

  return (
    <Layout title="Rule Editor">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="max-w-5xl mx-auto space-y-6"
      >
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-[#64748B] mb-2">
          <Link to="/workflows" className="hover:text-indigo-400 transition">Workflows</Link>
          <ChevronRight className="w-4 h-4" />
          <Link to={`/workflows/${id}/edit`} className="hover:text-indigo-400 transition truncate max-w-[150px]">{workflow?.name}</Link>
          <ChevronRight className="w-4 h-4" />
          <span className="text-white font-medium">{step?.name}</span>
          <ChevronRight className="w-4 h-4" />
          <span className="text-white font-medium">Rules</span>
        </div>

        {/* Step Info Banner */}
        <div className="bg-[#141428] border border-[#2D2D5E] rounded-2xl p-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-indigo-500/20 rounded-xl flex items-center justify-center">
              <Settings className="w-6 h-6 text-indigo-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">{step?.name}</h2>
              <div className="flex items-center gap-3 mt-1 text-sm">
                <span className="text-[#94A3B8]">Type: <StatusBadge status={step?.step_type} size="sm" /></span>
                <span className="w-1 h-1 rounded-full bg-[#2D2D5E]" />
                <span className="text-[#94A3B8]">Workflow: <strong className="text-white">{workflow?.name}</strong></span>
              </div>
            </div>
          </div>
          <button onClick={() => navigate(`/workflows/${id}/edit`)} className="p-2 hover:bg-[#1A1A35] rounded-lg text-[#64748B] hover:text-white transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Default Rule Warning */}
        {!hasDefault && (
          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-yellow-400 mt-0.5" />
            <div>
              <h4 className="text-sm font-bold text-yellow-400">⚠️ No DEFAULT rule found!</h4>
              <p className="text-sm text-yellow-400/80">Add a rule with condition <code className="bg-yellow-500/20 px-1.5 rounded font-bold text-yellow-300">DEFAULT</code> to handle unmatched scenarios.</p>
            </div>
          </div>
        )}

        {/* Rules Table */}
        <div className="bg-[#141428] border border-[#2D2D5E] rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#0A0A14] border-b border-[#2D2D5E]">
                <th className="px-6 py-4 text-left text-[#64748B] text-xs uppercase tracking-wider font-medium w-24">Priority</th>
                <th className="px-6 py-4 text-left text-[#64748B] text-xs uppercase tracking-wider font-medium">Condition</th>
                <th className="px-6 py-4 text-left text-[#64748B] text-xs uppercase tracking-wider font-medium">Next Step</th>
                <th className="px-6 py-4 text-right text-[#64748B] text-xs uppercase tracking-wider font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rules.sort((a,b) => a.priority - b.priority).map((r, index) => {
                const isDef = r.condition_expr.toUpperCase() === 'DEFAULT';
                return (
                  <motion.tr 
                    key={r.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className={`border-b border-[#1A1A35] transition-colors ${isDef ? 'bg-yellow-500/5 border-l-4 border-l-yellow-500' : 'hover:bg-[#1A1A35]'}`}
                  >
                    <td className="px-6 py-4">
                      {isDef 
                        ? <span className="text-yellow-400 font-bold text-xs">DEFAULT</span> 
                        : <span className="w-8 h-8 bg-indigo-600/20 text-indigo-400 rounded-full flex items-center justify-center font-bold text-sm">{r.priority}</span>
                      }
                    </td>
                    <td className="px-6 py-4">
                      <code className={`text-sm font-mono px-3 py-1.5 rounded-lg border ${
                        isDef 
                          ? 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400' 
                          : 'bg-[#0A0A14] border-[#2D2D5E] text-[#94A3B8]'
                      }`}>
                        {r.condition_expr}
                      </code>
                    </td>
                    <td className="px-6 py-4">
                      <span className="flex items-center gap-2 text-indigo-400 font-medium">
                        → {workflow?.steps?.find(s => s.id === r.next_step_id)?.name || <span className="text-[#64748B] italic">🏁 End Workflow</span>}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-1">
                        <button onClick={() => startEdit(r)} className="p-1.5 text-[#64748B] hover:text-indigo-400 hover:bg-indigo-500/10 rounded-lg transition-all">
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleDeleteRule(r.id)} className="p-1.5 text-[#64748B] hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </motion.tr>
                );
              })}
              {rules.length === 0 && (
                <tr>
                  <td colSpan="4" className="px-6 py-16 text-center">
                    <div className="flex flex-col items-center justify-center">
                      <AlertTriangle className="w-12 h-12 mb-3 text-[#2D2D5E]" />
                      <p className="font-medium text-white">No rules defined for this step yet.</p>
                      <p className="text-xs text-[#64748B] mt-1">Add one below to handle flow logic.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Add/Edit Rule Card + Syntax Panel */}
        <div className="grid grid-cols-12 gap-8">
          <div className="col-span-12 lg:col-span-8">
            <div className="bg-[#141428] border border-[#2D2D5E] rounded-2xl p-6">
              <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                {editingRule ? <Edit2 className="w-5 h-5 text-indigo-400" /> : <Plus className="w-5 h-5 text-indigo-400" />}
                {editingRule ? 'Edit Existing Rule' : 'Add New Rule'}
              </h3>
              
              <form onSubmit={handleSaveRule} className="space-y-6">
                <div>
                  <label className="block text-xs font-bold text-[#94A3B8] uppercase tracking-wider mb-2">Condition Expression *</label>
                  <input 
                    type="text"
                    value={ruleForm.condition_expr}
                    onChange={e => setRuleForm({...ruleForm, condition_expr: e.target.value})}
                    className="w-full bg-[#0A0A14] border border-[#2D2D5E] text-white rounded-xl px-4 py-3 font-mono text-sm placeholder-[#64748B] focus:outline-none focus:border-indigo-500 focus:shadow-[0_0_0_3px_rgba(99,102,241,0.1)] transition-all"
                    placeholder="amount > 100 && country == 'US'"
                  />
                  {/* Operator pills */}
                  <div className="mt-2 flex flex-wrap gap-1">
                    {['==', '!=', '>', '<', '>=', '<=', '&&', '||', 'DEFAULT'].map(op => (
                      <button
                        key={op}
                        type="button"
                        onClick={() => appendToCondition(op)}
                        className={`px-2 py-1 rounded-lg text-xs font-mono transition-all border ${
                          op === 'DEFAULT'
                            ? 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/20'
                            : 'bg-[#0A0A14] border-[#2D2D5E] text-indigo-400 hover:bg-indigo-500/10'
                        }`}
                      >
                        {op}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="block text-xs font-bold text-[#94A3B8] uppercase tracking-wider mb-2">Priority</label>
                    <input 
                      type="number"
                      value={ruleForm.priority}
                      onChange={e => setRuleForm({...ruleForm, priority: parseInt(e.target.value)})}
                      className="w-full bg-[#0A0A14] border border-[#2D2D5E] text-white rounded-xl px-4 py-3 focus:outline-none focus:border-indigo-500 transition-all"
                      placeholder="1"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[#94A3B8] uppercase tracking-wider mb-2">Next Step *</label>
                    <select 
                      value={ruleForm.next_step_id}
                      onChange={e => setRuleForm({...ruleForm, next_step_id: e.target.value})}
                      className="w-full bg-[#0A0A14] border border-[#2D2D5E] text-white rounded-xl px-4 py-3 focus:outline-none focus:border-indigo-500 transition-all"
                    >
                      <option value="">Select a step...</option>
                      <option value="__END__">🏁 End Workflow</option>
                      {workflow?.steps?.filter(s => s.id !== stepId).map(s => (
                        <option key={s.id} value={s.id}>{s.name} ({s.step_type})</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#2D2D5E]">
                  {editingRule && (
                    <button 
                      type="button" 
                      onClick={() => { setEditingRule(null); setRuleForm({ priority: rules.length+1, condition_expr: '', next_step_id: '' }); }}
                      className="px-6 py-2.5 text-[#94A3B8] hover:text-white hover:bg-[#1A1A35] rounded-xl font-medium transition-all"
                    >
                      Cancel
                    </button>
                  )}
                  <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.95 }}
                    type="submit"
                    className="bg-indigo-600 hover:bg-indigo-500 text-white px-8 py-2.5 rounded-xl font-bold flex items-center gap-2 transition-all hover:shadow-[0_0_20px_rgba(99,102,241,0.4)]"
                  >
                    <Save className="w-4 h-4" />
                    {editingRule ? 'Update Rule' : 'Add Rule'}
                  </motion.button>
                </div>
              </form>
            </div>
          </div>

          {/* Language Syntax Panel */}
          <div className="col-span-12 lg:col-span-4">
            <div className="bg-[#141428] border border-[#2D2D5E] rounded-2xl p-6 space-y-4 sticky top-24">
              <h4 className="font-bold text-white flex items-center gap-2">
                <Lightbulb className="w-5 h-5 text-amber-400" />
                💡 Language Syntax
              </h4>
              <div className="space-y-2">
                {[
                  { op: '== != > < >= <=', desc: 'Standard comparisons', color: 'text-indigo-400' },
                  { op: '&& ||', desc: 'Logical AND/OR', color: 'text-purple-400' },
                  { op: 'contains(f, "v")', desc: 'String search', color: 'text-green-400' },
                  { op: 'startsWith(f, "v")', desc: 'Matches start', color: 'text-yellow-400' },
                  { op: 'endsWith(f, "v")', desc: 'Matches end', color: 'text-yellow-400' },
                  { op: 'DEFAULT', desc: 'Fall-through handler', color: 'text-orange-400 font-bold' },
                ].map((item, i) => (
                  <div key={i} className="flex flex-col p-3 bg-[#0A0A14] rounded-xl border border-[#2D2D5E] hover:border-[#3D3D7E] transition">
                    <code className={`text-xs font-bold font-mono ${item.color}`}>{item.op}</code>
                    <span className="text-[11px] text-[#64748B] mt-0.5">{item.desc}</span>
                  </div>
                ))}
              </div>
              <div className="p-3 bg-blue-500/10 rounded-xl flex gap-3 text-xs text-blue-400 border border-blue-500/20">
                <Info className="w-4 h-4 shrink-0 mt-0.5" />
                <p>Rules are evaluated in ascending order of priority. The first match wins.</p>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </Layout>
  );
}
