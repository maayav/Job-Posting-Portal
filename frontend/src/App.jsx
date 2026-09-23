import { lazy, Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute';
import LoginPage from './pages/LoginPage';

// Route-level code splitting keeps the first paint small: the landing page and
// login stay eager, everything else loads on navigation.
const LandingPage = lazy(() => import('./pages/LandingPage'));
const JobSearchPage = lazy(() => import('./pages/JobSearchPage'));
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const UploadPage = lazy(() => import('./pages/UploadPage'));
const AssistantPage = lazy(() => import('./pages/AssistantPage'));
const AdminJobsPage = lazy(() => import('./pages/AdminJobsPage'));
const MyApplicationsPage = lazy(() => import('./pages/MyApplicationsPage'));
const AdminApplicationsPage = lazy(() => import('./pages/AdminApplicationsPage'));

function RouteFallback() {
  return (
    <div className="page center" role="status">
      <div className="spinner" />
      <p className="muted">Loading…</p>
    </div>
  );
}

export default function App() {
  return (
    <Suspense fallback={<RouteFallback />}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<LandingPage />} />
        <Route
          path="/jobs"
          element={
            <ProtectedRoute>
              <JobSearchPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <DashboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/analyze"
          element={
            <ProtectedRoute requiredRole="student">
              <UploadPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/analysis/new"
          element={
            <ProtectedRoute>
              <UploadPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/assistant"
          element={
            <ProtectedRoute>
              <AssistantPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/jobs"
          element={
            <ProtectedRoute requiredRole="admin">
              <AdminJobsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/applications"
          element={
            <ProtectedRoute>
              <MyApplicationsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/applications"
          element={
            <ProtectedRoute requiredRole="admin">
              <AdminApplicationsPage />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<div className="page"><div className="card center"><h1>Page not found</h1><p className="muted">That Vortex workspace route does not exist.</p><a className="primary inline" href="/">Back to home</a></div></div>} />
      </Routes>
    </Suspense>
  );
}
