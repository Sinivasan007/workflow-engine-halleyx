/**
 * routes/approval.js
 * PUBLIC routes — no auth middleware.
 * Approvers click these links from their email.
 *
 * GET /approval/approve/:token
 * GET /approval/reject/:token
 */

const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { runExecution } = require('../services/executionService');

/* ─── shared HTML response builder ────────────────────────────────────── */
function htmlPage(title, emoji, message, color) {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>${title}</title></head>
<body style="margin:0;padding:0;background:#0F0F1A;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;">
  <div style="text-align:center;max-width:480px;padding:48px 40px;background:#141428;border:1px solid #2D2D5E;border-radius:20px;box-shadow:0 20px 60px rgba(0,0,0,0.5);">
    <div style="font-size:64px;margin-bottom:16px;">${emoji}</div>
    <h1 style="color:${color};font-size:24px;margin:0 0 12px;">${title}</h1>
    <p style="color:#94A3B8;font-size:15px;line-height:1.6;margin:0;">${message}</p>
    <p style="color:#64748B;font-size:12px;margin-top:24px;">You can close this tab now.</p>
  </div>
</body>
</html>`;
}

/* ─── GET /approval/approve/:token ─────────────────────────────────────── */
router.get('/approve/:token', async (req, res) => {
  const { token } = req.params;

  try {
    // 1. Find the log entry with this token
    const [[logEntry]] = await pool.execute(
      `SELECT el.*, e.workflow_id, e.input_data, e.triggered_by, w.name AS workflow_name
         FROM execution_logs el
         JOIN executions e ON e.id = el.execution_id
         LEFT JOIN workflows w ON w.id = e.workflow_id
        WHERE el.approval_token = ?`,
      [token]
    );

    if (!logEntry) {
      return res.status(404).send(htmlPage(
        'Invalid Token', '⚠️',
        'This approval link is invalid or has already been used.',
        '#F59E0B'
      ));
    }

    // 2. Check expiry
    if (logEntry.token_expires_at && new Date(logEntry.token_expires_at) < new Date()) {
      return res.status(410).send(htmlPage(
        'Link Expired', '⏰',
        'This approval link has expired. Please ask the workflow owner to re-trigger the execution.',
        '#F59E0B'
      ));
    }

    // 3. Check if already acted upon
    if (logEntry.status !== 'in_progress') {
      return res.send(htmlPage(
        'Already Processed', 'ℹ️',
        `This step has already been ${logEntry.status}. No further action is needed.`,
        '#818CF8'
      ));
    }

    // 4. Approve: close the pending log
    const now = new Date();
    await pool.execute(
      `UPDATE execution_logs
          SET status = 'completed',
              approver_id = 'email_approval',
              ended_at = ?,
              approval_token = NULL
        WHERE id = ?`,
      [now, logEntry.id]
    );

    // 5. Evaluate rules and advance execution
    const executionId = logEntry.execution_id;
    const currentStepId = logEntry.step_id;

    // Load rules for the current step
    const [rules] = await pool.execute(
      `SELECT * FROM rules WHERE step_id = ? ORDER BY priority ASC`,
      [currentStepId]
    );

    const { evaluateCondition } = require('../services/ruleEngine');
    let rawInputData = {};
    try {
      rawInputData = typeof logEntry.input_data === 'string'
        ? JSON.parse(logEntry.input_data)
        : (logEntry.input_data || {});
      if (rawInputData.input_data && typeof rawInputData.input_data === 'object') {
        rawInputData = rawInputData.input_data;
      }
    } catch { rawInputData = {}; }

    let matchedRule = null;
    for (const rule of rules) {
      const result = evaluateCondition(rule.condition_expr, rawInputData);
      if (result && !matchedRule) matchedRule = rule;
    }

    const nextStepId = matchedRule
      ? (matchedRule.next_step_id && matchedRule.next_step_id !== 'null' ? matchedRule.next_step_id : null)
      : null;

    await pool.execute(
      `UPDATE executions SET current_step_id = ? WHERE id = ?`,
      [nextStepId ?? currentStepId, executionId]
    );

    if (nextStepId) {
      await runExecution(executionId, pool);
    } else {
      await pool.execute(
        `UPDATE executions SET status = 'completed', ended_at = ? WHERE id = ?`,
        [now, executionId]
      );
    }

    return res.send(htmlPage(
      'Request Approved', '✅',
      'You have approved this request. The workflow will continue processing.',
      '#22C55E'
    ));

  } catch (err) {
    console.error('[approval] approve error:', err.message);
    return res.status(500).send(htmlPage(
      'Error', '❌',
      'An unexpected error occurred while processing your approval. Please try again.',
      '#EF4444'
    ));
  }
});

/* ─── GET /approval/reject/:token ──────────────────────────────────────── */
router.get('/reject/:token', async (req, res) => {
  const { token } = req.params;

  try {
    const [[logEntry]] = await pool.execute(
      `SELECT * FROM execution_logs WHERE approval_token = ?`,
      [token]
    );

    if (!logEntry) {
      return res.status(404).send(htmlPage(
        'Invalid Token', '⚠️',
        'This rejection link is invalid or has already been used.',
        '#F59E0B'
      ));
    }

    if (logEntry.token_expires_at && new Date(logEntry.token_expires_at) < new Date()) {
      return res.status(410).send(htmlPage(
        'Link Expired', '⏰',
        'This link has expired.',
        '#F59E0B'
      ));
    }

    if (logEntry.status !== 'in_progress') {
      return res.send(htmlPage(
        'Already Processed', 'ℹ️',
        `This step has already been ${logEntry.status}.`,
        '#818CF8'
      ));
    }

    // Reject: mark log as failed, cancel execution
    const now = new Date();
    await pool.execute(
      `UPDATE execution_logs
          SET status = 'failed',
              approver_id = 'email_rejection',
              error_message = 'Rejected via email',
              ended_at = ?,
              approval_token = NULL
        WHERE id = ?`,
      [now, logEntry.id]
    );

    await pool.execute(
      `UPDATE executions SET status = 'canceled', ended_at = ? WHERE id = ?`,
      [now, logEntry.execution_id]
    );

    return res.send(htmlPage(
      'Request Rejected', '❌',
      'You have rejected this request. The workflow has been stopped.',
      '#EF4444'
    ));

  } catch (err) {
    console.error('[approval] reject error:', err.message);
    return res.status(500).send(htmlPage(
      'Error', '❌',
      'An unexpected error occurred. Please try again.',
      '#EF4444'
    ));
  }
});

module.exports = router;
