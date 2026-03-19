const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const workflowRoutes = require('./routes/workflows');
const stepRoutes = require('./routes/steps');
const ruleRoutes = require('./routes/rules');
const executionRoutes = require('./routes/executions');
const authRoutes = require('./routes/auth');
const approvalRoutes = require('./routes/approval');
const authMiddleware = require('./middleware/auth');

const app = express();

// CORS — restrict to frontend origin
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
}));

// Body parser with size limit
app.use(express.json({ limit: '1mb' }));

// Rate limiting on auth endpoints (prevent brute force)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // max 20 requests per window
  message: { error: 'Too many attempts. Please try again after 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiting on execution endpoints
const executionLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30,
  message: { error: 'Too many execution requests. Please slow down.' },
});

// Public Routes (no auth)
app.use('/auth', authLimiter, authRoutes);
app.use('/approval', approvalRoutes);

// Protected Routes
app.use('/workflows', authMiddleware, workflowRoutes);
app.use('/', authMiddleware, stepRoutes);
app.use('/', authMiddleware, ruleRoutes);
app.use('/', authMiddleware, executionRoutes);

// Health check
app.get('/', (req, res) => {
  res.json({ message: 'Halleyx Workflow Engine API is running 🚀' });
});

// Global error handler — never expose internals to client
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
