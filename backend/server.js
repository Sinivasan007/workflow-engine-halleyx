const express = require('express');
const cors = require('cors');
require('dotenv').config();

const workflowRoutes = require('./routes/workflows');
const stepRoutes = require('./routes/steps');
const ruleRoutes = require('./routes/rules');
const executionRoutes = require('./routes/executions');

const app = express();

app.use(cors());
app.use(express.json());

// Routes
app.use('/workflows', workflowRoutes);
app.use('/', stepRoutes);
app.use('/', ruleRoutes);
app.use('/', executionRoutes);

// Health check
app.get('/', (req, res) => {
  res.json({ message: 'Halleyx Workflow Engine API is running 🚀' });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: err.message });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
