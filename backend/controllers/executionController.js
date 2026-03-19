/**
 * executionController.js
 * Halleyx Workflow Engine — Execution API Endpoints
 *
 * Routes handled here (via routes/executions.js):
 *   POST   /workflows/:workflow_id/execute  → startExecution
 *   POST   /executions/:id/approve          → approveExecution
 *   GET    /executions                      → getAllExecutions
 *   GET    /executions/:id                  → getExecutionById
 *   POST   /executions/:id/cancel           → cancelExecution
 *   POST   /executions/:id/retry            → retryExecution
 */

const pool               = require('../config/db');
const { v4: uuidv4 }     = require('uuid');
const { runExecution }   = require('../services/executionService');
const { validateInputSchema } = require('../services/ruleEngine');

// ─────────────────────────────────────────────────────────────────────────────
// Helper — parse JSON strings coming from MySQL
// ─────────────────────────────────────────────────────────────────────────────
function parseJSON(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'object') return value;
  try { return JSON.parse(value); } catch { return null; }
}

/**
 * Replace {{fieldName}} and {fieldName} placeholders with actual values from data.
 * E.g. "Hello {{employee_name}}" + { employee_name: 'John' } → "Hello John"
 */
function resolveTemplate(template, data) {
  if (!template || typeof template !== 'string') return template || '';
  if (!data || typeof data !== 'object') return template;
  // Replace {{key}} first, then {key}
  let resolved = template.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (match, key) => {
    return data[key] !== undefined && data[key] !== null ? String(data[key]) : match;
  });
  resolved = resolved.replace(/\{\s*([\w.]+)\s*\}/g, (match, key) => {
    return data[key] !== undefined && data[key] !== null ? String(data[key]) : match;
  });
  return resolved;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper — fetch execution + parsed logs + timeline, used by multiple endpoints
// ─────────────────────────────────────────────────────────────────────────────
async function fetchExecutionWithLogs(id, userId) {
  const [[execution]] = await pool.execute(
    `SELECT e.*, w.name AS workflow_name
       FROM executions e
       LEFT JOIN workflows w ON w.id = e.workflow_id
      WHERE e.id = ? AND e.user_id = ?`,
    [id, userId]
  );
  if (!execution) return null;

  const [logs] = await pool.execute(
    `SELECT el.*, s.metadata AS step_metadata
       FROM execution_logs el
       LEFT JOIN steps s ON s.id = el.step_id
      WHERE el.execution_id = ?
      ORDER BY el.started_at ASC, el.ended_at ASC`,
    [id]
  );

  const inputData = parseJSON(execution.input_data) || {};

  const parsedLogs = logs.map((log) => {
    const meta = parseJSON(log.step_metadata) || {};
    // Resolve template placeholders in notification metadata using input_data
    if (log.step_type === 'notification' && Object.keys(meta).length > 0) {
      const fieldsToResolve = ['template', 'message', 'body', 'content', 'to', 'email', 'recipient', 'address', 'assignee_email'];
      for (const field of fieldsToResolve) {
        if (meta[field] && typeof meta[field] === 'string') {
          meta[field] = resolveTemplate(meta[field], inputData);
        }
      }
    }
    return {
      ...log,
      evaluated_rules: parseJSON(log.evaluated_rules),
      metadata: meta,
    };
  });

  // Build timeline from logs
  const timeline = parsedLogs.map((log) => ({
    step_name:  log.step_name,
    step_type:  log.step_type,
    status:     log.status,
    started_at: log.started_at,
    ended_at:   log.ended_at,
  }));

  return {
    ...execution,
    input_data: parseJSON(execution.input_data),
    logs:       parsedLogs,
    timeline,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. POST /workflows/:workflow_id/execute
// ─────────────────────────────────────────────────────────────────────────────
const startExecution = async (req, res) => {
  try {
    const { workflow_id } = req.params;
    const { triggered_by, input_data } = req.body;
    // input_data is the actual fields object (e.g. { salary: 75000, role_level: 'Director' })
    const inputFields = input_data || {};

    // Load workflow (ensure it belongs to the user)
    const [[workflow]] = await pool.execute(
      `SELECT * FROM workflows WHERE id = ? AND user_id = ?`,
      [workflow_id, req.user.id]
    );
    if (!workflow) return res.status(404).json({ error: 'Workflow not found' });
    if (!workflow.is_active) return res.status(400).json({ error: 'Workflow is not active' });

    // Validate input against input_schema
    const inputSchema = parseJSON(workflow.input_schema);
    if (inputSchema) {
      const validation = validateInputSchema(inputSchema, inputFields);
      if (!validation.valid) {
        return res.status(400).json({ error: 'Input validation failed', errors: validation.errors });
      }
    }

    // Create execution record (status = in_progress immediately — engine runs now)
    const id  = uuidv4();
    const now = new Date();

    await pool.execute(
      `INSERT INTO executions
         (id, user_id, workflow_id, workflow_version, status, input_data,
          current_step_id, retries, triggered_by, started_at)
       VALUES (?, ?, ?, ?, 'in_progress', ?, ?, 0, ?, ?)`,
      [
        id,
        req.user.id,
        workflow_id,
        workflow.version,
        JSON.stringify(inputFields),
        workflow.start_step_id || null,
        triggered_by || 'system',
        now,
      ]
    );

    // Run the execution engine
    const result = await runExecution(id, pool);

    if (result.error && !result.execution) {
      return res.status(400).json({ error: result.error });
    }

    const full = await fetchExecutionWithLogs(id, req.user.id);
    return res.status(201).json(full);

  } catch (err) {
    console.error('startExecution error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// 2. POST /executions/:id/approve
// ─────────────────────────────────────────────────────────────────────────────
const approveExecution = async (req, res) => {
  try {
    const { id } = req.params;
    const { approver_id } = req.body;

    if (!approver_id) return res.status(400).json({ error: 'approver_id is required' });

    // Load execution (ensure it belongs to the user)
    const [[execution]] = await pool.execute(
      `SELECT * FROM executions WHERE id = ? AND user_id = ?`,
      [id, req.user.id]
    );
    if (!execution) return res.status(404).json({ error: 'Execution not found' });

    if (execution.status !== 'in_progress') {
      return res.status(400).json({
        error: `Cannot approve — execution is "${execution.status}", expected "in_progress"`,
      });
    }

    // Validate the current step is an approval step
    const currentStepId = execution.current_step_id;
    if (!currentStepId) {
      return res.status(400).json({ error: 'Execution has no current step to approve' });
    }

    const [[step]] = await pool.execute(
      `SELECT * FROM steps WHERE id = ?`,
      [currentStepId]
    );
    if (!step) return res.status(404).json({ error: 'Current step not found' });

    if (step.step_type !== 'approval') {
      return res.status(400).json({
        error: `Current step "${step.name}" is type "${step.step_type}", not "approval"`,
      });
    }

    // Close the pending log for this step — stamp approver and ended_at
    const now = new Date();
    await pool.execute(
      `UPDATE execution_logs
          SET status     = 'completed',
              approver_id = ?,
              ended_at   = ?,
              approval_token = NULL
        WHERE execution_id = ?
          AND step_id      = ?
          AND status       = 'in_progress'`,
      [approver_id, now, id, currentStepId]
    );

    // Evaluate rules to get the next step
    const [rules] = await pool.execute(
      `SELECT * FROM rules WHERE step_id = ? ORDER BY priority ASC`,
      [currentStepId]
    );

    const { evaluateCondition } = require('../services/ruleEngine');
    // Unwrap input_data: handle both { input_data: {...} } nesting and flat objects
    let rawInputData = parseJSON(execution.input_data) || {};
    if (rawInputData.input_data && typeof rawInputData.input_data === 'object') {
      rawInputData = rawInputData.input_data; // unwrap double-nesting
    }
    const inputData = rawInputData;

    let matchedRule = null;
    for (const rule of rules) {
      const result = evaluateCondition(rule.condition_expr, inputData);
      if (result && !matchedRule) {
        matchedRule = rule;
      }
    }

    // Advance current_step_id to the next step (or stay on this one for the engine to complete)
    const nextStepId = matchedRule 
      ? (matchedRule.next_step_id && matchedRule.next_step_id !== 'null' ? matchedRule.next_step_id : null) 
      : null;

    await pool.execute(
      `UPDATE executions SET current_step_id = ? WHERE id = ?`,
      [nextStepId ?? currentStepId, id]
    );

    // Continue running the execution engine from the next step
    if (nextStepId) {
      await runExecution(id, pool);
    } else {
      // No next step → mark completed
      await pool.execute(
        `UPDATE executions SET status = 'completed', ended_at = ? WHERE id = ?`,
        [now, id]
      );
    }

    const full = await fetchExecutionWithLogs(id, req.user.id);
    return res.json(full);

  } catch (err) {
    console.error('approveExecution error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// 3. GET /executions  (with workflow name + pagination)
// ─────────────────────────────────────────────────────────────────────────────
const getAllExecutions = async (req, res) => {
  try {
    const { status, workflow_id, search, page = 1, limit = 10 } = req.query;
    const parsedPage   = Math.max(1, parseInt(page) || 1);
    const parsedLimit  = Math.min(100, Math.max(1, parseInt(limit) || 10));
    const parsedOffset = (parsedPage - 1) * parsedLimit;

    // Build dynamic WHERE
    const conditions = ['e.user_id = ?'];
    const params     = [req.user.id];

    if (status)      { conditions.push('e.status = ?');      params.push(status); }
    if (workflow_id) { conditions.push('e.workflow_id = ?'); params.push(workflow_id); }
    if (search)      { conditions.push('w.name LIKE ?');     params.push(`%${search}%`); }

    const where = conditions.join(' AND ');

    const [rows] = await pool.execute(
      `SELECT e.*, w.name AS workflow_name
         FROM executions e
         LEFT JOIN workflows w ON w.id = e.workflow_id
        WHERE ${where}
        ORDER BY e.started_at DESC
        LIMIT ${parsedLimit} OFFSET ${parsedOffset}`,
      params
    );

    const [[{ total }]] = await pool.execute(
      `SELECT COUNT(*) AS total FROM executions e LEFT JOIN workflows w ON w.id = e.workflow_id WHERE ${where}`,
      params
    );

    res.json({
      data: rows.map((r) => ({ ...r, input_data: parseJSON(r.input_data) })),
      pagination: {
        total,
        page:       parsedPage,
        limit:      parsedLimit,
        totalPages: Math.ceil(total / parsedLimit),
      },
    });
  } catch (err) {
    console.error('getAllExecutions error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// 4. GET /executions/:id  (with full logs + timeline)
// ─────────────────────────────────────────────────────────────────────────────
const getExecutionById = async (req, res) => {
  try {
    const full = await fetchExecutionWithLogs(req.params.id, req.user.id);
    if (!full) return res.status(404).json({ error: 'Execution not found' });
    res.json(full);
  } catch (err) {
    console.error('getExecutionById error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// 5. POST /executions/:id/cancel
// ─────────────────────────────────────────────────────────────────────────────
const cancelExecution = async (req, res) => {
  try {
    const { id } = req.params;

    const [[existing]] = await pool.execute(
      `SELECT * FROM executions WHERE id = ? AND user_id = ?`,
      [id, req.user.id]
    );
    if (!existing) return res.status(404).json({ error: 'Execution not found' });

    if (!['pending', 'in_progress'].includes(existing.status)) {
      return res.status(400).json({
        error: `Cannot cancel execution with status "${existing.status}"`,
      });
    }

    const now = new Date();
    await pool.execute(
      `UPDATE executions SET status = 'canceled', ended_at = ? WHERE id = ? AND user_id = ?`,
      [now, id, req.user.id]
    );

    const [[updated]] = await pool.execute(
      `SELECT * FROM executions WHERE id = ? AND user_id = ?`,
      [id, req.user.id]
    );
    res.json({ message: 'Execution canceled successfully', execution: updated });
  } catch (err) {
    console.error('cancelExecution error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// 6. POST /executions/:id/retry
//    Re-runs ONLY the failed step — does NOT restart from the beginning.
// ─────────────────────────────────────────────────────────────────────────────
const retryExecution = async (req, res) => {
  try {
    const { id } = req.params;

    const [[existing]] = await pool.execute(
      `SELECT * FROM executions WHERE id = ? AND user_id = ?`,
      [id, req.user.id]
    );
    if (!existing) return res.status(404).json({ error: 'Execution not found' });

    if (existing.status !== 'failed') {
      return res.status(400).json({
        error: `Only "failed" executions can be retried. Current status: "${existing.status}"`,
      });
    }

    // Keep current_step_id as-is → engine resumes from the failed step
    await pool.execute(
      `UPDATE executions
          SET status  = 'in_progress',
              retries = retries + 1,
              ended_at = NULL
        WHERE id = ? AND user_id = ?`,
      [id, req.user.id]
    );

    // Re-run from the current (failed) step
    const result = await runExecution(id, pool);

    if (result.error && !result.execution) {
      return res.status(400).json({ error: result.error });
    }

    const full = await fetchExecutionWithLogs(id, req.user.id);
    return res.json(full);

  } catch (err) {
    console.error('retryExecution error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
module.exports = {
  startExecution,
  approveExecution,
  getAllExecutions,
  getExecutionById,
  cancelExecution,
  retryExecution,
};
