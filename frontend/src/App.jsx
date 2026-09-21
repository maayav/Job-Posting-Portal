import { lazy, Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute';
import LoginPage from './pages/LoginPage';
import UploadPage from './pages/UploadPage';
import DashboardPage from './pages/DashboardPage';
import JobSearchPage from './pages/JobSearchPage';
import AdminJobsPage from './pages/AdminJobsPage';
import AssistantPage from './pages/AssistantPage';
import LandingPage from './pages/LandingPage';
import MyApplicationsPage from './pages/MyApplicationsPage';
const AdminApplicationsPage = lazy(() => import('./pages/AdminApplicationsPage'));

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/"
        element={
          <LandingPage />
        }
      />
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
            <Suspense fallback={<div className="page center" role="status">Loading applications…</div>}>
              <AdminApplicationsPage />
            </Suspense>
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<div className="page"><div className="card center"><h1>Page not found</h1><p className="muted">That Vortex workspace route does not exist.</p><a className="primary inline" href="/">Back to home</a></div></div>} />
    </Routes>
  );
}
