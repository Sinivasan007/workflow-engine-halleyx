const pool = require('../config/db');
const { v4: uuidv4 } = require('uuid');

// POST /workflows/:workflow_id/steps
const addStep = async (req, res) => {
  try {
    const { workflow_id } = req.params;
    const { name, step_type, step_order, metadata } = req.body;

    // Verify workflow exists AND belongs to this user
    const [workflow] = await pool.execute('SELECT id FROM workflows WHERE id = ? AND user_id = ?', [workflow_id, req.user.id]);
    if (workflow.length === 0) return res.status(404).json({ error: 'Workflow not found' });

    if (!name || !step_type) return res.status(400).json({ error: 'name and step_type are required' });

    const validTypes = ['task', 'approval', 'notification'];
    if (!validTypes.includes(step_type)) {
      return res.status(400).json({ error: `step_type must be one of: ${validTypes.join(', ')}` });
    }

    const id = uuidv4();
    const now = new Date();

    await pool.execute(
      `INSERT INTO steps (id, workflow_id, name, step_type, step_order, metadata, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        workflow_id,
        name,
        step_type,
        step_order || 1,
        metadata ? JSON.stringify(metadata) : null,
        now,
        now,
      ]
    );

    const [rows] = await pool.execute('SELECT * FROM steps WHERE id = ?', [id]);
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('addStep error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// GET /workflows/:workflow_id/steps
const getStepsByWorkflow = async (req, res) => {
  try {
    const { workflow_id } = req.params;

    // Verify workflow belongs to this user
    const [workflow] = await pool.execute('SELECT id FROM workflows WHERE id = ? AND user_id = ?', [workflow_id, req.user.id]);
    if (workflow.length === 0) return res.status(404).json({ error: 'Workflow not found' });

    const [steps] = await pool.execute(
      'SELECT * FROM steps WHERE workflow_id = ? ORDER BY step_order ASC',
      [workflow_id]
    );
    res.json(steps);
  } catch (err) {
    console.error('getStepsByWorkflow error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// PUT /steps/:id
const updateStep = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, step_type, step_order, metadata } = req.body;

    // Verify step exists AND belongs to user's workflow
    const [existing] = await pool.execute(
      `SELECT s.* FROM steps s
       JOIN workflows w ON w.id = s.workflow_id
       WHERE s.id = ? AND w.user_id = ?`,
      [id, req.user.id]
    );
    if (existing.length === 0) return res.status(404).json({ error: 'Step not found' });

    if (step_type) {
      const validTypes = ['task', 'approval', 'notification'];
      if (!validTypes.includes(step_type)) {
        return res.status(400).json({ error: `step_type must be one of: ${validTypes.join(', ')}` });
      }
    }

    const now = new Date();
    await pool.execute(
      `UPDATE steps SET name = ?, step_type = ?, step_order = ?, metadata = ?, updated_at = ? WHERE id = ?`,
      [
        name ?? existing[0].name,
        step_type ?? existing[0].step_type,
        step_order ?? existing[0].step_order,
        metadata ? JSON.stringify(metadata) : existing[0].metadata,
        now,
        id,
      ]
    );

    const [updated] = await pool.execute('SELECT * FROM steps WHERE id = ?', [id]);
    res.json(updated[0]);
  } catch (err) {
    console.error('updateStep error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// DELETE /steps/:id
const deleteStep = async (req, res) => {
  try {
    const { id } = req.params;

    // Verify step belongs to user's workflow
    const [existing] = await pool.execute(
      `SELECT s.id FROM steps s
       JOIN workflows w ON w.id = s.workflow_id
       WHERE s.id = ? AND w.user_id = ?`,
      [id, req.user.id]
    );
    if (existing.length === 0) return res.status(404).json({ error: 'Step not found' });

    await pool.execute('DELETE FROM steps WHERE id = ?', [id]);
    res.json({ message: 'Step deleted successfully' });
  } catch (err) {
    console.error('deleteStep error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = { addStep, getStepsByWorkflow, updateStep, deleteStep };

