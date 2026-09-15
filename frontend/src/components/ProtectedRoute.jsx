import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function ProtectedRoute({ children, requiredRole }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;

  if (requiredRole && user.role !== requiredRole) {
    return (
      <div className="page">
        <div className="card center">
          <h2>403 — Not authorized</h2>
          <p className="muted">This page is available to administrators only.</p>
          <Link to="/jobs" className="primary inline">Back to jobs</Link>
        </div>
      </div>
    );
  }

  return children;
}