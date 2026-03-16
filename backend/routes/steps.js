const express = require('express');
const router = express.Router();
const {
  addStep,
  getStepsByWorkflow,
  updateStep,
  deleteStep,
} = require('../controllers/stepController');

// POST   /workflows/:workflow_id/steps  → Add step to workflow
router.post('/workflows/:workflow_id/steps', addStep);

// GET    /workflows/:workflow_id/steps  → Get all steps of workflow
router.get('/workflows/:workflow_id/steps', getStepsByWorkflow);

// PUT    /steps/:id                     → Update step
router.put('/steps/:id', updateStep);

// DELETE /steps/:id                     → Delete step
router.delete('/steps/:id', deleteStep);

module.exports = router;
