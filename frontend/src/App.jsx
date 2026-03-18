import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { ToastProvider } from './components/Toast';

import WorkflowList    from './pages/WorkflowList';
import WorkflowEditor  from './pages/WorkflowEditor';
import RuleEditor      from './pages/RuleEditor';
import ExecutionView   from './pages/ExecutionView';
import AuditLog        from './pages/AuditLog';

function AnimatedRoutes() {
  const location = useLocation();
  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/" element={<Navigate to="/workflows" replace />} />
        <Route path="/workflows" element={<WorkflowList />} />
        <Route path="/workflows/new" element={<WorkflowEditor />} />
        <Route path="/workflows/:id/edit" element={<WorkflowEditor />} />
        <Route path="/workflows/:id/steps/:stepId/rules" element={<RuleEditor />} />
        <Route path="/workflows/:id/execute" element={<ExecutionView />} />
        <Route path="/executions/:id" element={<ExecutionView />} />
        <Route path="/audit" element={<AuditLog />} />
      </Routes>
    </AnimatePresence>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <AnimatedRoutes />
      </ToastProvider>
    </BrowserRouter>
  );
}
