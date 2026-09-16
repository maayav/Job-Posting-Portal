import { Routes, Route } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute';
import LoginPage from './pages/LoginPage';
import UploadPage from './pages/UploadPage';
import DashboardPage from './pages/DashboardPage';
import JobSearchPage from './pages/JobSearchPage';
import AdminJobsPage from './pages/AdminJobsPage';
import AssistantPage from './pages/AssistantPage';
import LandingPage from './pages/LandingPage';

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
    </Routes>
  );
}
