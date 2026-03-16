const express = require('express');
const router = express.Router();
const {
  startExecution,
  approveExecution,
  getAllExecutions,
  getExecutionById,
  cancelExecution,
  retryExecution,
} = require('../controllers/executionController');

// POST   /workflows/:workflow_id/execute → Start execution
router.post('/workflows/:workflow_id/execute', startExecution);

// GET    /executions                     → Get all executions
router.get('/executions', getAllExecutions);

// GET    /executions/:id                 → Get one with logs
router.get('/executions/:id', getExecutionById);

// POST   /executions/:id/approve         → Approve paused step
router.post('/executions/:id/approve', approveExecution);

// POST   /executions/:id/cancel          → Cancel execution
router.post('/executions/:id/cancel', cancelExecution);

// POST   /executions/:id/retry           → Retry failed step
router.post('/executions/:id/retry', retryExecution);

module.exports = router;
