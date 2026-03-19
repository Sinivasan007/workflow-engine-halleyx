import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation, useParams } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { ToastProvider } from './components/Toast';
import { NotificationProvider } from './context/NotificationContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import NotificationToast from './components/ui/NotificationToast';

import WorkflowList    from './pages/WorkflowList';
import WorkflowEditor  from './pages/WorkflowEditor';
import RuleEditor      from './pages/RuleEditor';
import ExecutionView   from './pages/ExecutionView';
import AuditLog        from './pages/AuditLog';
import LandingPage     from './pages/LandingPage';
import SignIn          from './pages/SignIn';
import SignUp          from './pages/SignUp';

function WorkflowRedirect() {
  const { id } = useParams();
  return <Navigate to={`/workflows/${id}/edit`} replace />;
}

// Protected Route Component
function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return null; // Or a loading spinner
  
  if (!user) {
    return <Navigate to="/signin" state={{ from: location }} replace />;
  }

  return children;
}

// Public Route Component (redirects to /workflows if logged in)
function PublicRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) return <Navigate to="/workflows" replace />;
  return children;
}

function AnimatedRoutes() {
  const location = useLocation();
  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        {/* Public Routes */}
        <Route path="/" element={<LandingPage />} />
        <Route path="/signin" element={<PublicRoute><SignIn /></PublicRoute>} />
        <Route path="/signup" element={<PublicRoute><SignUp /></PublicRoute>} />

        {/* Protected Routes */}
        <Route path="/workflows" element={<ProtectedRoute><WorkflowList /></ProtectedRoute>} />
        <Route path="/workflows/new" element={<ProtectedRoute><WorkflowEditor /></ProtectedRoute>} />
        <Route path="/workflows/:id/edit" element={<ProtectedRoute><WorkflowEditor /></ProtectedRoute>} />
        <Route path="/workflows/:id/steps/:stepId/rules" element={<ProtectedRoute><RuleEditor /></ProtectedRoute>} />
        <Route path="/workflows/:id/execute" element={<ProtectedRoute><ExecutionView /></ProtectedRoute>} />
        <Route path="/workflows/:id" element={<ProtectedRoute><WorkflowRedirect /></ProtectedRoute>} />
        <Route path="/executions/:id" element={<ProtectedRoute><ExecutionView /></ProtectedRoute>} />
        <Route path="/audit" element={<ProtectedRoute><AuditLog /></ProtectedRoute>} />
        
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AnimatePresence>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <NotificationProvider>
          <ToastProvider>
            <AnimatedRoutes />
            <NotificationToast />
          </ToastProvider>
        </NotificationProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
