import { Link, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function ProtectedRoute({ children, requiredRole }) {
  const { user } = useAuth();
  const location = useLocation();
  if (!user) {
    const returnTo = `${location.pathname}${location.search}${location.hash}`;
    return <Navigate to={`/login?returnTo=${encodeURIComponent(returnTo)}`} replace />;
  }

  if (requiredRole && user.role !== requiredRole) {
    const audience = requiredRole === 'admin' ? 'administrators' : 'students';
    const fallback = requiredRole === 'admin' ? '/jobs' : '/dashboard';
    return (
      <div className="page">
        <div className="card center">
          <h2>403 — Not authorized</h2>
          <p className="muted">This page is available to {audience} only.</p>
          <Link to={fallback} className="primary inline">{requiredRole === 'admin' ? 'Back to jobs' : 'Back to dashboard'}</Link>
        </div>
      </div>
    );
  }

  return children;
}
