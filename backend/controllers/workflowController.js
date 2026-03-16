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
      `INSERT INTO workflows (id, name, description, version, is_active, input_schema, start_step_id, created_at, updated_at)
       VALUES (?, ?, ?, 1, true, ?, ?, ?, ?)`,
      [
        id,
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
    res.status(500).json({ error: err.message });
  }
};

// GET /workflows  (search + pagination)
const getAllWorkflows = async (req, res) => {
  try {
    const { search = '', page = 1, limit = 10 } = req.query;
    const parsedLimit  = parseInt(limit)  || 10;
    const parsedOffset = (parseInt(page) - 1) * parsedLimit;

    const [rows] = await pool.execute(
      `SELECT * FROM workflows
       WHERE name LIKE ? OR description LIKE ?
       ORDER BY created_at DESC
       LIMIT ${parsedLimit} OFFSET ${parsedOffset}`,
      [`%${search}%`, `%${search}%`]
    );

    const [[{ total }]] = await pool.execute(
      `SELECT COUNT(*) AS total FROM workflows WHERE name LIKE ? OR description LIKE ?`,
      [`%${search}%`, `%${search}%`]
    );

    res.json({
      data: rows,
      pagination: {
        total,
        page: parseInt(page),
        limit: parsedLimit,
        totalPages: Math.ceil(total / parsedLimit),
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// GET /workflows/:id  (with steps + rules nested)
const getWorkflowById = async (req, res) => {
  try {
    const { id } = req.params;

    const [workflows] = await pool.execute('SELECT * FROM workflows WHERE id = ?', [id]);
    if (workflows.length === 0) return res.status(404).json({ error: 'Workflow not found' });

    const workflow = workflows[0];

    // Fetch steps ordered by step_order
    const [steps] = await pool.execute(
      'SELECT * FROM steps WHERE workflow_id = ? ORDER BY step_order ASC',
      [id]
    );

    // Fetch rules for each step ordered by priority
    for (const step of steps) {
      const [rules] = await pool.execute(
        'SELECT * FROM rules WHERE step_id = ? ORDER BY priority ASC',
        [step.id]
      );
      step.rules = rules;
    }

    workflow.steps = steps;
    res.json(workflow);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// PUT /workflows/:id  (update + bump version)
const updateWorkflow = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, input_schema, start_step_id, is_active } = req.body;

    const [existing] = await pool.execute('SELECT * FROM workflows WHERE id = ?', [id]);
    if (existing.length === 0) return res.status(404).json({ error: 'Workflow not found' });

    const now = new Date();
    await pool.execute(
      `UPDATE workflows
       SET name = ?, description = ?, input_schema = ?, start_step_id = ?, is_active = ?,
           version = version + 1, updated_at = ?
       WHERE id = ?`,
      [
        name ?? existing[0].name,
        description ?? existing[0].description,
        input_schema ? JSON.stringify(input_schema) : existing[0].input_schema,
        start_step_id ?? existing[0].start_step_id,
        is_active ?? existing[0].is_active,
        now,
        id,
      ]
    );

    const [updated] = await pool.execute('SELECT * FROM workflows WHERE id = ?', [id]);
    res.json(updated[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// DELETE /workflows/:id
const deleteWorkflow = async (req, res) => {
  try {
    const { id } = req.params;

    const [existing] = await pool.execute('SELECT * FROM workflows WHERE id = ?', [id]);
    if (existing.length === 0) return res.status(404).json({ error: 'Workflow not found' });

    await pool.execute('DELETE FROM workflows WHERE id = ?', [id]);
    res.json({ message: 'Workflow deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = {
  createWorkflow,
  getAllWorkflows,
  getWorkflowById,
  updateWorkflow,
  deleteWorkflow,
};
