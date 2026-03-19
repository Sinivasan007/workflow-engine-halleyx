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

// ── CORS ──────────────────────────────────────────────
const allowedOrigins = [
  'http://localhost:3000',
  'https://workflowenginehalleyx.vercel.app',
  process.env.FRONTEND_URL,
].filter(Boolean);

app.use(cors({
  origin: function (origin, callback) {
    // Allow Postman / mobile / server-to-server (no origin)
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.log('❌ CORS blocked:', origin);
      callback(new Error(`CORS policy: origin ${origin} not allowed`));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Handle ALL preflight requests
app.options('*', cors());

// ── Body Parser ───────────────────────────────────────
app.use(express.json({ limit: '1mb' }));

// ── Rate Limiting ─────────────────────────────────────
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'Too many attempts. Please try again after 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const executionLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: { error: 'Too many execution requests. Please slow down.' },
});

// ── Public Routes ─────────────────────────────────────
app.use('/auth', authLimiter, authRoutes);
app.use('/approval', approvalRoutes);

// ── Protected Routes ──────────────────────────────────
app.use('/workflows', authMiddleware, workflowRoutes);
app.use('/', authMiddleware, stepRoutes);
app.use('/', authMiddleware, ruleRoutes);
app.use('/', authMiddleware, executionRoutes);

// ── Health Check ──────────────────────────────────────
app.get('/', (req, res) => {
  res.json({
    message: 'Halleyx Workflow Engine API is running 🚀',
    allowedOrigins
  });
});

// ── Global Error Handler ──────────────────────────────
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`✅ Allowed origins:`, allowedOrigins);
});