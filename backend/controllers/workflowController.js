const pool = require('../config/db');
const { v4: uuidv4 } = require('uuid');

// POST /workflows
const createWorkflow = async (req, res) => {
  try {
    const { name, description, input_schema, start_step_id } = req.body;
    if (!name) return res.status(400).json({ error: 'name is required' });

    const id = uuidv4();
    const now = new Date();

    await pool.execute(
      `INSERT INTO workflows (id, user_id, name, description, version, is_active, input_schema, start_step_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, 1, true, ?, ?, ?, ?)`,
      [
        id,
        req.user.id,
        name,
        description || null,
        input_schema ? JSON.stringify(input_schema) : null,
        start_step_id || null,
        now,
        now,
      ]
    );

    const [rows] = await pool.execute('SELECT * FROM workflows WHERE id = ?', [id]);
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('createWorkflow error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// GET /workflows  (search + pagination)
const getAllWorkflows = async (req, res) => {
  try {
    const { search = '', status, page = 1, limit = 10 } = req.query;
    const parsedPage   = Math.max(1, parseInt(page) || 1);
    const parsedLimit  = Math.min(100, Math.max(1, parseInt(limit) || 10));
    const parsedOffset = (parsedPage - 1) * parsedLimit;

    // Build dynamic conditions
    const conditions = ['w.user_id = ?', '(w.name LIKE ? OR w.description LIKE ?)'];
    const params = [req.user.id, `%${search}%`, `%${search}%`];

    if (status === 'active')   { conditions.push('w.is_active = 1'); }
    if (status === 'inactive') { conditions.push('w.is_active = 0'); }

    const where = conditions.join(' AND ');

    const [rows] = await pool.execute(
      `SELECT w.*, COUNT(DISTINCT s.id) as step_count
       FROM workflows w
       LEFT JOIN steps s ON s.workflow_id = w.id
       WHERE ${where}
       GROUP BY w.id
       ORDER BY w.created_at DESC
       LIMIT ${parsedLimit} OFFSET ${parsedOffset}`,
      params
    );

    const [[{ total }]] = await pool.execute(
      `SELECT COUNT(*) AS total FROM workflows w WHERE ${where}`,
      params
    );

    res.json({
      data: rows,
      pagination: {
        total,
        page: parsedPage,
        limit: parsedLimit,
        totalPages: Math.ceil(total / parsedLimit),
      },
    });
  } catch (err) {
    console.error('getAllWorkflows error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// GET /workflows/:id  (with steps + rules nested)
const getWorkflowById = async (req, res) => {
  try {
    const { id } = req.params;

    const [workflows] = await pool.execute('SELECT * FROM workflows WHERE id = ? AND user_id = ?', [id, req.user.id]);
    if (workflows.length === 0) return res.status(404).json({ error: 'Workflow not found' });

    const workflow = workflows[0];

    // Fetch steps ordered by step_order
    const [steps] = await pool.execute(
      'SELECT * FROM steps WHERE workflow_id = ?', // steps are implicitly tied to workflow, which is user-filtered
      [id]
    );

    // Fetch all rules for all steps in one query (avoids N+1)
    if (steps.length > 0) {
      const stepIds = steps.map(s => s.id);
      const placeholders = stepIds.map(() => '?').join(',');
      const [allRules] = await pool.execute(
        `SELECT * FROM rules WHERE step_id IN (${placeholders}) ORDER BY priority ASC`,
        stepIds
      );
      for (const step of steps) {
        step.rules = allRules.filter(r => r.step_id === step.id);
      }
    } else {
      // No steps, nothing to do
    }

    workflow.steps = steps;
    res.json(workflow);
  } catch (err) {
    console.error('getWorkflowById error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// PUT /workflows/:id  (update + bump version)
const updateWorkflow = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, input_schema, start_step_id, is_active } = req.body;

    const [existing] = await pool.execute('SELECT * FROM workflows WHERE id = ? AND user_id = ?', [id, req.user.id]);
    if (existing.length === 0) return res.status(404).json({ error: 'Workflow not found' });

    const now = new Date();
    await pool.execute(
      `UPDATE workflows
       SET name = ?, description = ?, input_schema = ?, start_step_id = ?, is_active = ?,
           version = version + 1, updated_at = ?
       WHERE id = ? AND user_id = ?`,
      [
        name ?? existing[0].name,
        description ?? existing[0].description,
        input_schema ? JSON.stringify(input_schema) : existing[0].input_schema,
        start_step_id ?? existing[0].start_step_id,
        is_active ?? existing[0].is_active,
        now,
        id,
        req.user.id
      ]
    );

    const [updated] = await pool.execute('SELECT * FROM workflows WHERE id = ? AND user_id = ?', [id, req.user.id]);
    res.json(updated[0]);
  } catch (err) {
    console.error('updateWorkflow error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// DELETE /workflows/:id
const deleteWorkflow = async (req, res) => {
  try {
    const { id } = req.params;

    const [existing] = await pool.execute('SELECT * FROM workflows WHERE id = ? AND user_id = ?', [id, req.user.id]);
    if (existing.length === 0) return res.status(404).json({ error: 'Workflow not found' });

    await pool.execute('DELETE FROM workflows WHERE id = ? AND user_id = ?', [id, req.user.id]);
    res.json({ message: 'Workflow deleted successfully' });
  } catch (err) {
    console.error('deleteWorkflow error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = {
  createWorkflow,
  getAllWorkflows,
  getWorkflowById,
  updateWorkflow,
  deleteWorkflow,
};
