const express = require('express');
const router = express.Router();
const {
  addRule,
  getRulesByStep,
  updateRule,
  deleteRule,
} = require('../controllers/ruleController');

// POST   /steps/:step_id/rules   → Add rule to step
router.post('/steps/:step_id/rules', addRule);

// GET    /steps/:step_id/rules   → Get all rules ordered by priority
router.get('/steps/:step_id/rules', getRulesByStep);

// PUT    /rules/:id              → Update rule
router.put('/rules/:id', updateRule);

// DELETE /rules/:id              → Delete rule
router.delete('/rules/:id', deleteRule);

module.exports = router;
