import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import NavBar from '../components/NavBar';
import AdminCandidateDashboard from '../components/AdminCandidateDashboard';
import ScoreCard from '../components/ScoreCard';
import ProgressChart from '../components/ProgressChart';
import { api, errorMessage } from '../api/client';

function StudentDashboard() {
  const [report, setReport] = useState(null);
  const [history, setHistory] = useState([]);
  const [appliedCount, setAppliedCount] = useState(0);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const reportId = localStorage.getItem('report_id');

    api
      .get('/applications/me')
      .then((res) => setAppliedCount(res.data.applications?.length ?? 0))
      .catch(() => setAppliedCount(0));

    api
      .get('/report/history')
      .then((res) => setHistory(res.data.history ?? []))
      .catch(() => setHistory([]));

    if (!reportId) {
      setLoading(false);
      return;
    }
    api
      .get(`/report/${reportId}`)
      .then((res) => setReport(res.data))
      .catch((err) => {
        // A report id can survive a logout/account switch. Treat an inaccessible
        // old report as no current report rather than surfacing a misleading 403.
        if ([403, 404].includes(err.response?.status)) {
          localStorage.removeItem('report_id');
          setReport(null);
          setError('');
          return;
        }
        setError(errorMessage(err));
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <>
      <div className="page-title-row">
        <div>
          <p className="section-kicker">YOUR DASHBOARD</p>
          <h1>Your readiness at a glance.</h1>
        </div>
      </div>

      {loading && <p className="muted">Loading dashboard…</p>}

      {error && <p className="error card-error">{error}</p>}

      {!loading && (
        <div className="dashboard-stack">
          {report ? (
            <ScoreCard score={report.score} targetRole={report.target_role} generatedAt={report.generated_at} />
          ) : (
            !error && (
              <div className="card center">
                <h2>No report yet</h2>
                <p className="muted">Upload a resume to get your readiness score.</p>
                <Link to="/analyze" className="primary inline">Start a new analysis</Link>
              </div>
            )
          )}

          <div className="card dashboard-stat">
            <div>
              <p className="section-kicker">APPLICATIONS</p>
              <h2>Jobs applied</h2>
            </div>
            <div className="dashboard-stat-value">
              <strong>{appliedCount}</strong>
              <Link to="/applications" className="landing-text-link">View applications <span aria-hidden="true">→</span></Link>
            </div>
          </div>

          <ProgressChart history={history} />
        </div>
      )}
    </>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  return (
    <div className="page">
      <NavBar />
      {user?.role === 'admin' ? <AdminCandidateDashboard /> : <StudentDashboard />}
    </div>
  );
}