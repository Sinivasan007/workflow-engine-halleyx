const pool = require('../config/db');
const { v4: uuidv4 } = require('uuid');

/** Sanitize next_step_id: convert 'null', '', '__END__' → actual null */
function sanitizeNextStepId(val) {
  if (val === null || val === undefined) return null;
  if (typeof val === 'string') {
    const t = val.trim();
    if (t === '' || t === 'null' || t === 'undefined' || t === '__END__') return null;
  }
  return val;
}

// POST /steps/:step_id/rules
const addRule = async (req, res) => {
  try {
    const { step_id } = req.params;
    const { condition_expr, next_step_id, priority } = req.body;

    const [step] = await pool.execute('SELECT id FROM steps WHERE id = ?', [step_id]);
    if (step.length === 0) return res.status(404).json({ error: 'Step not found' });

    if (!condition_expr) return res.status(400).json({ error: 'condition_expr is required' });

    const id = uuidv4();
    const now = new Date();

    await pool.execute(
      `INSERT INTO rules (id, step_id, condition_expr, next_step_id, priority, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        step_id,
        condition_expr,
        sanitizeNextStepId(next_step_id),
        priority || 1,
        now,
        now,
      ]
    );

    const [rows] = await pool.execute('SELECT * FROM rules WHERE id = ?', [id]);
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// GET /steps/:step_id/rules  (ordered by priority ASC)
const getRulesByStep = async (req, res) => {
  try {
    const { step_id } = req.params;

    const [step] = await pool.execute('SELECT id FROM steps WHERE id = ?', [step_id]);
    if (step.length === 0) return res.status(404).json({ error: 'Step not found' });

    const [rules] = await pool.execute(
      'SELECT * FROM rules WHERE step_id = ? ORDER BY priority ASC',
      [step_id]
    );
    res.json(rules);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// PUT /rules/:id
const updateRule = async (req, res) => {
  try {
    const { id } = req.params;
    const { condition_expr, next_step_id, priority } = req.body;

    const [existing] = await pool.execute('SELECT * FROM rules WHERE id = ?', [id]);
    if (existing.length === 0) return res.status(404).json({ error: 'Rule not found' });

    const now = new Date();
    await pool.execute(
      `UPDATE rules SET condition_expr = ?, next_step_id = ?, priority = ?, updated_at = ? WHERE id = ?`,
      [
        condition_expr ?? existing[0].condition_expr,
        next_step_id !== undefined ? sanitizeNextStepId(next_step_id) : existing[0].next_step_id,
        priority ?? existing[0].priority,
        now,
        id,
      ]
    );

    const [updated] = await pool.execute('SELECT * FROM rules WHERE id = ?', [id]);
    res.json(updated[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// DELETE /rules/:id
const deleteRule = async (req, res) => {
  try {
    const { id } = req.params;

    const [existing] = await pool.execute('SELECT * FROM rules WHERE id = ?', [id]);
    if (existing.length === 0) return res.status(404).json({ error: 'Rule not found' });

    await pool.execute('DELETE FROM rules WHERE id = ?', [id]);
    res.json({ message: 'Rule deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = { addRule, getRulesByStep, updateRule, deleteRule };
