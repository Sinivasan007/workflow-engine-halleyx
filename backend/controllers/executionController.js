const pool = require('../config/db');
const { v4: uuidv4 } = require('uuid');

// POST /workflows/:workflow_id/execute  → PLACEHOLDER (Day 2)
const startExecution = async (req, res) => {
  try {
    const { workflow_id } = req.params;
    const { input_data, triggered_by } = req.body;

    // Verify workflow exists
    const [workflow] = await pool.execute('SELECT * FROM workflows WHERE id = ?', [workflow_id]);
    if (workflow.length === 0) return res.status(404).json({ error: 'Workflow not found' });

    if (!workflow[0].is_active) {
      return res.status(400).json({ error: 'Workflow is not active' });
    }

    const id = uuidv4();
    const now = new Date();

    await pool.execute(
      `INSERT INTO executions (id, workflow_id, workflow_version, status, input_data, current_step_id, retries, triggered_by, started_at)
       VALUES (?, ?, ?, 'pending', ?, ?, 0, ?, ?)`,
      [
        id,
        workflow_id,
        workflow[0].version,
        input_data ? JSON.stringify(input_data) : null,
        workflow[0].start_step_id || null,
        triggered_by || 'system',
        now,
      ]
    );

    const [rows] = await pool.execute('SELECT * FROM executions WHERE id = ?', [id]);
    res.status(201).json({
      message: 'Execution created (full engine logic coming in Day 2)',
      execution: rows[0],
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// GET /executions
const getAllExecutions = async (req, res) => {
  try {
    const { status, workflow_id, page = 1, limit = 10 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let query = 'SELECT * FROM executions WHERE 1=1';
    const params = [];

    if (status) {
      query += ' AND status = ?';
      params.push(status);
    }
    if (workflow_id) {
      query += ' AND workflow_id = ?';
      params.push(workflow_id);
    }

    query += ' ORDER BY started_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), offset);

    const [rows] = await pool.execute(query, params);

    // Count total
    let countQuery = 'SELECT COUNT(*) AS total FROM executions WHERE 1=1';
    const countParams = [];
    if (status) { countQuery += ' AND status = ?'; countParams.push(status); }
    if (workflow_id) { countQuery += ' AND workflow_id = ?'; countParams.push(workflow_id); }

    const [[{ total }]] = await pool.execute(countQuery, countParams);

    res.json({
      data: rows,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// GET /executions/:id  (with logs)
const getExecutionById = async (req, res) => {
  try {
    const { id } = req.params;

    const [executions] = await pool.execute('SELECT * FROM executions WHERE id = ?', [id]);
    if (executions.length === 0) return res.status(404).json({ error: 'Execution not found' });

    const execution = executions[0];

    const [logs] = await pool.execute(
      'SELECT * FROM execution_logs WHERE execution_id = ? ORDER BY started_at ASC',
      [id]
    );

    execution.logs = logs;
    res.json(execution);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// POST /executions/:id/cancel
const cancelExecution = async (req, res) => {
  try {
    const { id } = req.params;

    const [existing] = await pool.execute('SELECT * FROM executions WHERE id = ?', [id]);
    if (existing.length === 0) return res.status(404).json({ error: 'Execution not found' });

    const cancelableStatuses = ['pending', 'in_progress'];
    if (!cancelableStatuses.includes(existing[0].status)) {
      return res.status(400).json({ error: `Cannot cancel execution with status: ${existing[0].status}` });
    }

    const now = new Date();
    await pool.execute(
      `UPDATE executions SET status = 'canceled', ended_at = ? WHERE id = ?`,
      [now, id]
    );

    const [updated] = await pool.execute('SELECT * FROM executions WHERE id = ?', [id]);
    res.json({ message: 'Execution canceled successfully', execution: updated[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// POST /executions/:id/retry  → PLACEHOLDER (Day 2)
const retryExecution = async (req, res) => {
  try {
    const { id } = req.params;

    const [existing] = await pool.execute('SELECT * FROM executions WHERE id = ?', [id]);
    if (existing.length === 0) return res.status(404).json({ error: 'Execution not found' });

    if (existing[0].status !== 'failed') {
      return res.status(400).json({ error: 'Only failed executions can be retried' });
    }

    // PLACEHOLDER — full retry engine logic in Day 2
    res.json({
      message: 'Retry endpoint registered (full retry logic coming in Day 2)',
      execution_id: id,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = {
  startExecution,
  getAllExecutions,
  getExecutionById,
  cancelExecution,
  retryExecution,
};
