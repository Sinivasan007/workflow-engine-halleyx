-- ============================================================
-- Halleyx Workflow Engine — Database Schema
-- MySQL 8.0+
-- ============================================================

CREATE DATABASE IF NOT EXISTS halleyx_workflow;
USE halleyx_workflow;

-- ──────────────────────────────────────────────────────────────
-- 1. USERS — Authentication & profiles
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id          VARCHAR(36) PRIMARY KEY,
  username    VARCHAR(100) NOT NULL,
  email       VARCHAR(255) NOT NULL UNIQUE,
  password    VARCHAR(255) NOT NULL,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- ──────────────────────────────────────────────────────────────
-- 2. WORKFLOWS — Workflow definitions
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS workflows (
  id            VARCHAR(36) PRIMARY KEY,
  user_id       VARCHAR(36),
  name          VARCHAR(255) NOT NULL,
  description   TEXT,
  version       INT DEFAULT 1,
  is_active     BOOLEAN DEFAULT TRUE,
  input_schema  JSON,
  start_step_id VARCHAR(36),
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- ──────────────────────────────────────────────────────────────
-- 3. STEPS — Workflow steps (task / approval / notification)
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS steps (
  id           VARCHAR(36) PRIMARY KEY,
  workflow_id  VARCHAR(36) NOT NULL,
  name         VARCHAR(255) NOT NULL,
  step_type    ENUM('task', 'approval', 'notification') NOT NULL,
  step_order   INT DEFAULT 1,
  metadata     JSON,
  created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (workflow_id) REFERENCES workflows(id) ON DELETE CASCADE
);

-- ──────────────────────────────────────────────────────────────
-- 4. RULES — Conditional routing rules per step
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rules (
  id              VARCHAR(36) PRIMARY KEY,
  step_id         VARCHAR(36) NOT NULL,
  condition_expr  TEXT NOT NULL,
  next_step_id    VARCHAR(36),
  priority        INT DEFAULT 1,
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (step_id) REFERENCES steps(id) ON DELETE CASCADE
);

-- ──────────────────────────────────────────────────────────────
-- 5. EXECUTIONS — Workflow execution instances
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS executions (
  id                VARCHAR(36) PRIMARY KEY,
  user_id           VARCHAR(36),
  workflow_id       VARCHAR(36) NOT NULL,
  workflow_version  INT,
  status            ENUM('pending', 'in_progress', 'completed', 'failed', 'canceled') DEFAULT 'pending',
  input_data        JSON,
  current_step_id   VARCHAR(36),
  retries           INT DEFAULT 0,
  triggered_by      VARCHAR(255) DEFAULT 'system',
  started_at        TIMESTAMP NULL,
  ended_at          TIMESTAMP NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (workflow_id) REFERENCES workflows(id) ON DELETE CASCADE
);

-- ──────────────────────────────────────────────────────────────
-- 6. EXECUTION_LOGS — Per-step execution audit trail
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS execution_logs (
  id                 VARCHAR(36) PRIMARY KEY,
  execution_id       VARCHAR(36) NOT NULL,
  step_id            VARCHAR(36),
  step_name          VARCHAR(255),
  step_type          VARCHAR(50),
  evaluated_rules    JSON,
  selected_next_step VARCHAR(255),
  status             ENUM('pending', 'in_progress', 'completed', 'failed', 'skipped') DEFAULT 'completed',
  approver_id        VARCHAR(255),
  error_message      TEXT,
  approval_token     VARCHAR(255),
  token_expires_at   DATETIME,
  started_at         TIMESTAMP NULL,
  ended_at           TIMESTAMP NULL,
  FOREIGN KEY (execution_id) REFERENCES executions(id) ON DELETE CASCADE
);

-- ──────────────────────────────────────────────────────────────
-- INDEXES — Performance optimization
-- ──────────────────────────────────────────────────────────────
CREATE INDEX idx_steps_workflow ON steps(workflow_id);
CREATE INDEX idx_rules_step ON rules(step_id);
CREATE INDEX idx_executions_workflow ON executions(workflow_id);
CREATE INDEX idx_executions_status ON executions(status);
CREATE INDEX idx_executions_user ON executions(user_id);
CREATE INDEX idx_exec_logs_execution ON execution_logs(execution_id);
CREATE INDEX idx_exec_logs_approval ON execution_logs(approval_token);
