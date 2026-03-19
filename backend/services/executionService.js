/**
 * executionService.js
 * Halleyx Workflow Engine — Core Execution Engine
 *
 * Exports:
 *   runExecution(executionId, db) → { execution, logs, timeline }
 */

const { v4: uuidv4 } = require('uuid');
const { getNextStep } = require('./ruleEngine');



// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Convert the string 'null', empty string, or 'undefined' to actual null. */
function normalizeNull(val) {
  if (val === null || val === undefined) return null;
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (trimmed === '' || trimmed === 'null' || trimmed === 'undefined') return null;
  }
  return val;
}

/** Safely parse JSON stored as a string in MySQL, or return the value as-is. */
function parseJSON(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'object') return value;          // already parsed by mysql2
  try { return JSON.parse(value); } catch { return {}; }
}

/** Write one row to execution_logs. */
async function writeLog(db, logData) {
  const id = uuidv4();
  const now = new Date();
  await db.execute(
    `INSERT INTO execution_logs
       (id, execution_id, step_id, step_name, step_type,
        evaluated_rules, selected_next_step,
        status, approver_id, error_message,
        started_at, ended_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      logData.execution_id,
      logData.step_id        ?? null,
      logData.step_name      ?? null,
      logData.step_type      ?? null,
      JSON.stringify(logData.evaluated_rules ?? []),
      logData.selected_next_step ?? null,
      logData.status         ?? 'completed',
      logData.approver_id    ?? null,
      logData.error_message  ?? null,
      logData.started_at     ?? now,
      logData.ended_at       ?? now,
    ]
  );
  return id;
}

/** Mark an execution as failed with a reason, and write an error log. */
async function failExecution(db, executionId, stepId, stepName, reason) {
  const now = new Date();
  await db.execute(
    `UPDATE executions SET status = 'failed', ended_at = ? WHERE id = ?`,
    [now, executionId]
  );
  await writeLog(db, {
    execution_id:      executionId,
    step_id:           stepId,
    step_name:         stepName,
    step_type:         null,
    evaluated_rules:   [],
    selected_next_step: null,
    status:            'failed',
    error_message:     reason,
    started_at:        now,
    ended_at:          now,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// runExecution
// ─────────────────────────────────────────────────────────────────────────────
async function runExecution(executionId, db) {
  try {
    // ── 1. Load execution ────────────────────────────────────────────────────
    const [[execution]] = await db.execute(
      `SELECT * FROM executions WHERE id = ?`,
      [executionId]
    );
    if (!execution) {
      return { error: `Execution "${executionId}" not found.` };
    }

    // ── 2. Load workflow ─────────────────────────────────────────────────────
    const [[workflow]] = await db.execute(
      `SELECT * FROM workflows WHERE id = ?`,
      [execution.workflow_id]
    );
    if (!workflow) {
      return { error: `Workflow "${execution.workflow_id}" not found.` };
    }

    // ── 3. Stamp workflow version on execution ───────────────────────────────
    await db.execute(
      `UPDATE executions SET workflow_version = ? WHERE id = ?`,
      [workflow.version, executionId]
    );

    // ── 4. Validate execution status ─────────────────────────────────────────
    if (execution.status !== 'in_progress') {
      return {
        error: `Execution is "${execution.status}" — only "in_progress" executions can be run.`,
      };
    }

    // ── 5. Validate workflow has a start step ────────────────────────────────
    if (!workflow.start_step_id) {
      await failExecution(db, executionId, null, null, 'Workflow has no start step');
      return { error: 'Workflow has no start step' };
    }

    // ── 6 & 7. Determine the current step (start step or mid-flow resume) ───
    let currentStepId = normalizeNull(execution.current_step_id) || normalizeNull(workflow.start_step_id);

    // Validate the step belongs to this workflow
    const [[belongsCheck]] = await db.execute(
      `SELECT id FROM steps WHERE id = ? AND workflow_id = ?`,
      [currentStepId, workflow.id]
    );
    if (!belongsCheck) {
      const msg = `Step "${currentStepId}" does not belong to workflow "${workflow.id}"`;
      await failExecution(db, executionId, currentStepId, null, msg);
      return { error: msg };
    }

    // ── Parse input_data ─────────────────────────────────────────────────────
    // MySQL may return input_data as a JSON string OR already-parsed object
    const rawInput = execution.input_data || '{}';
    let inputData = typeof rawInput === 'string'
      ? (() => { try { return JSON.parse(rawInput); } catch { return {}; } })()
      : (typeof rawInput === 'object' ? rawInput : {});

    // Unwrap double-nesting: { input_data: { salary: 75000 } } → { salary: 75000 }
    if (inputData.input_data && typeof inputData.input_data === 'object' && !Array.isArray(inputData.input_data)) {
      inputData = inputData.input_data;
    }

    console.log('[executionService] Parsed inputData type:', typeof inputData, '| keys:', Object.keys(inputData));

    // ── Loop-detection tracker ───────────────────────────────────────────────
    const maxIterations = 10;
    const visitedSteps = {};
    const timeline    = [];   // accumulated timeline entries

    // ─────────────────────────────────────────────────────────────────────────
    // Main execution loop
    // ─────────────────────────────────────────────────────────────────────────
    while (currentStepId) {
      // ── 8. Load the current step ──────────────────────────────────────────
      const [[step]] = await db.execute(
        `SELECT * FROM steps WHERE id = ? AND workflow_id = ?`,
        [currentStepId, workflow.id]
      );
      if (!step) {
        const msg = `Step "${currentStepId}" not found in workflow "${workflow.id}"`;
        await failExecution(db, executionId, currentStepId, null, msg);
        return { error: msg, timeline };
      }

      // ── 16. Loop detection ───────────────────────────────────────────────
      if (!visitedSteps[currentStepId]) {
        visitedSteps[currentStepId] = 0;
      }
      visitedSteps[currentStepId]++;

      if (visitedSteps[currentStepId] > maxIterations) {
        // Mark execution as failed
        await db.query(
          `UPDATE executions 
           SET status = 'failed', 
               ended_at = NOW() 
           WHERE id = ?`,
          [executionId]
        );

        // Log the error
        await db.query(
          `INSERT INTO execution_logs 
           (id, execution_id, step_id, step_name,
            step_type, evaluated_rules, status, 
            error_message, started_at, ended_at)
           VALUES (?, ?, ?, ?, ?, ?, 'failed', ?, NOW(), NOW())`,
          [
            uuidv4(),
            executionId,
            step.id,
            step.name,
            step.step_type,
            JSON.stringify([]),
            `Max iterations reached for step: ${step.name}`
          ]
        );

        throw new Error(
          `Max iterations reached for step: ${step.name}`
        );
      }

      const stepStartedAt = new Date();

      // ── Update execution's current_step pointer ──────────────────────────
      await db.execute(
        `UPDATE executions SET current_step_id = ? WHERE id = ?`,
        [currentStepId, executionId]
      );

      // ── 8. Load rules for current step, ordered by priority ASC ─────────
      const [rules] = await db.execute(
        `SELECT * FROM rules WHERE step_id = ? ORDER BY priority ASC`,
        [step.id]
      );

      // ── 9 & 10. Evaluate ALL rules, log every result ──────────────────────
      const evaluatedRules = [];
      let matchedRule = null;

      if (rules.length > 0) {
        // Sort already done by DB, but ensure in-memory order too
        const sorted = [...rules].sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0));

        for (const rule of sorted) {
          const { evaluateCondition } = require('./ruleEngine');
          const result = evaluateCondition(rule.condition_expr, inputData, matchedRule !== null);

          evaluatedRules.push({
            rule:          rule.condition_expr,
            priority:      rule.priority,
            next_step_id:  rule.next_step_id,
            result,
          });

          if (result && !matchedRule) {
            matchedRule = rule; // first match wins — keep looping to log the rest
          }
        }
      }

      const nextStepId = matchedRule ? normalizeNull(matchedRule.next_step_id) : null;

      // Resolve next step UUID → human-readable name for selected_next_step
      let nextStepName = null;
      if (nextStepId) {
        const [nextStepRows] = await db.execute(
          `SELECT name FROM steps WHERE id = ?`,
          [nextStepId]
        );
        nextStepName = nextStepRows[0]?.name || null;
      }


      // ── 12. Handle step_type ─────────────────────────────────────────────
      let stepStatus = 'completed';
      let errorMessage = null;
      const stepEndedAt = new Date();

      if (step.step_type === 'task') {
        // AUTO — log metadata action and continue
        const metadata = parseJSON(step.metadata) || {};
        console.log(
          `[executionService] TASK step "${step.name}" executed. Action: ${metadata.action ?? '(none)'}`
        );

      } else if (step.step_type === 'notification') {
        // AUTO — mock send, log and continue
        const metadata = parseJSON(step.metadata) || {};
        const email = metadata.email ?? metadata.to ?? '(no email in metadata)';
        console.log(
          `[executionService] NOTIFICATION step "${step.name}": Notification sent to ${email}`
        );

      } else if (step.step_type === 'approval') {
        // PAUSE — generate approval token, send email, write in_progress log
        stepStatus = 'in_progress';
        const approvalToken = uuidv4();
        const tokenExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

        const logId = await writeLog(db, {
          execution_id:       executionId,
          step_id:            step.id,
          step_name:          step.name,
          step_type:          step.step_type,
          evaluated_rules:    evaluatedRules,
          selected_next_step: nextStepName,
          status:             'in_progress',
          started_at:         stepStartedAt,
          ended_at:           null,
        });

        // Store approval token on the log entry
        await db.execute(
          `UPDATE execution_logs SET approval_token = ?, token_expires_at = ? WHERE id = ?`,
          [approvalToken, tokenExpiresAt, logId]
        );

        // Execution stays in_progress, waiting for /approve
        await db.execute(
          `UPDATE executions SET status = 'in_progress', current_step_id = ? WHERE id = ?`,
          [currentStepId, executionId]
        );

        // Send approval email if approver email is configured
        const metadata = parseJSON(step.metadata) || {};
        const approverEmail = metadata.assignee_email || metadata.email || metadata.to;
        if (approverEmail) {
          try {
            const { sendApprovalEmail } = require('./emailService');
            // Load workflow name + triggered_by from execution
            const [[execInfo]] = await db.execute(
              `SELECT e.triggered_by, w.name AS workflow_name
                 FROM executions e
                 LEFT JOIN workflows w ON w.id = e.workflow_id
                WHERE e.id = ?`,
              [executionId]
            );
            await sendApprovalEmail({
              to: approverEmail,
              workflowName: execInfo?.workflow_name || 'Workflow',
              stepName: step.name,
              triggeredBy: execInfo?.triggered_by || 'system',
              inputData,
              token: approvalToken,
            });
            console.log(`[executionService] Approval email sent to ${approverEmail}`);
          } catch (emailErr) {
            console.error('[executionService] Failed to send approval email:', emailErr.message);
          }
        }

        timeline.push({ step: step.name, step_type: step.step_type, status: 'in_progress' });

        return await buildResult(db, executionId, timeline);
      }

      // ── 11. No rule matched → FAILED ────────────────────────────────────
      if (rules.length > 0 && !matchedRule) {
        errorMessage = `No rule matched for step "${step.name}"`;
        stepStatus   = 'failed';

        await writeLog(db, {
          execution_id:       executionId,
          step_id:            step.id,
          step_name:          step.name,
          step_type:          step.step_type,
          evaluated_rules:    evaluatedRules,
          selected_next_step: null,
          status:             'failed',
          error_message:      errorMessage,
          started_at:         stepStartedAt,
          ended_at:           stepEndedAt,
        });

        await db.execute(
          `UPDATE executions SET status = 'failed', ended_at = ? WHERE id = ?`,
          [stepEndedAt, executionId]
        );

        timeline.push({ step: step.name, step_type: step.step_type, status: 'failed' });
        return await buildResult(db, executionId, timeline);
      }

      // ── 11. Write completed log ──────────────────────────────────────────
      await writeLog(db, {
        execution_id:       executionId,
        step_id:            step.id,
        step_name:          step.name,
        step_type:          step.step_type,
        evaluated_rules:    evaluatedRules,
        selected_next_step: nextStepName,
        status:             stepStatus,
        started_at:         stepStartedAt,
        ended_at:           stepEndedAt,
      });

      timeline.push({ step: step.name, step_type: step.step_type, status: stepStatus });

      // ── 13 / 14. Move to next step or mark completed ─────────────────────
      if (nextStepId) {
        currentStepId = nextStepId;
        // Loop back to top
      } else {
        // No next step → workflow COMPLETED
        const now = new Date();
        await db.execute(
          `UPDATE executions SET status = 'completed', ended_at = ?, current_step_id = ? WHERE id = ?`,
          [now, currentStepId, executionId]
        );
        break;
      }
    }

    // ── 17. Return final result ──────────────────────────────────────────────
    return await buildResult(db, executionId, timeline);

  } catch (err) {
    console.error('[executionService] Unhandled error:', err.message);
    // Best-effort failure update
    try {
      await db.execute(
        `UPDATE executions SET status = 'failed', ended_at = ? WHERE id = ?`,
        [new Date(), executionId]
      );
    } catch (_) { /* ignore */ }
    return { error: err.message };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// buildResult — fetch fresh execution + its logs and return a clean object
// ─────────────────────────────────────────────────────────────────────────────
async function buildResult(db, executionId, timeline) {
  const [[execution]] = await db.execute(
    `SELECT * FROM executions WHERE id = ?`,
    [executionId]
  );

  const [logs] = await db.execute(
    `SELECT * FROM execution_logs WHERE execution_id = ? ORDER BY started_at ASC`,
    [executionId]
  );

  // Parse JSON columns in logs
  const parsedLogs = logs.map((log) => ({
    ...log,
    evaluated_rules: parseJSON(log.evaluated_rules),
  }));

  return { execution, logs: parsedLogs, timeline };
}

// ─────────────────────────────────────────────────────────────────────────────
module.exports = { runExecution };
