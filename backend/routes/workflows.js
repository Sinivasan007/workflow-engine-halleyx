const express = require('express');
const router = express.Router();
const {
  createWorkflow,
  getAllWorkflows,
  getWorkflowById,
  updateWorkflow,
  deleteWorkflow,
} = require('../controllers/workflowController');

// POST   /workflows              → Create workflow
router.post('/', createWorkflow);

// GET    /workflows              → List all (search + pagination)
router.get('/', getAllWorkflows);

// GET    /workflows/:id          → Get one with steps + rules nested
router.get('/:id', getWorkflowById);

// PUT    /workflows/:id          → Update + bump version
router.put('/:id', updateWorkflow);

// DELETE /workflows/:id          → Delete workflow
router.delete('/:id', deleteWorkflow);

module.exports = router;
