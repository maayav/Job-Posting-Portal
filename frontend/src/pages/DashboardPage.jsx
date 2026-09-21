import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import NavBar from '../components/NavBar';
import AdminCandidateDashboard from '../components/AdminCandidateDashboard';
import ScoreCard from '../components/ScoreCard';
import ProgressChart from '../components/ProgressChart';
import ApplyButton from '../components/ApplyButton';
import SaveButton from '../components/SaveButton';
import { api, errorMessage } from '../api/client';

function StudentDashboard() {
  const { user } = useAuth();
  const [report, setReport] = useState(null);
  const [history, setHistory] = useState([]);
  const [appliedCount, setAppliedCount] = useState(0);
  const [wishlist, setWishlist] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    api
      .get('/applications/me')
      .then((res) => { if (!cancelled) setAppliedCount(res.data.applications?.length ?? 0); })
      .catch(() => { if (!cancelled) setAppliedCount(0); });

    api
      .get('/wishlist')
      .then((res) => { if (!cancelled) setWishlist(res.data.items ?? []); })
      .catch(() => { if (!cancelled) setWishlist([]); });

    async function loadReport() {
      let reports = [];
      try {
        const res = await api.get('/report/history');
        reports = res.data.history ?? [];
      } catch {
        reports = [];
      }
      if (cancelled) return;
      setHistory(reports);

      // Prefer the report referenced locally, then fall back to this account's
      // latest completed report so the dashboard still works after re-login.
      const storedId = localStorage.getItem('report_id');
      const latestId = reports.length ? reports[reports.length - 1].report_id : null;
      const candidates = [...new Set([storedId, latestId].filter(Boolean))];

      for (const id of candidates) {
        try {
          const res = await api.get(`/report/${id}`);
          if (cancelled) return;
          setReport(res.data);
          localStorage.setItem('report_id', id);
          return;
        } catch (err) {
          if (cancelled) return;
          if ([403, 404].includes(err.response?.status)) {
            if (storedId === id) localStorage.removeItem('report_id');
            continue;
          }
          setError(errorMessage(err));
          return;
        }
      }
    }

    loadReport().finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  function handleAppliedFromWishlist(jobId) {
    setWishlist((current) => current.filter((item) => item.job.id !== jobId));
    setAppliedCount((current) => current + 1);
  }

  function handleRemovedFromWishlist(jobId) {
    setWishlist((current) => current.filter((item) => item.job.id !== jobId));
  }

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

          <div className="card saved-jobs">
            <div className="section-heading">
              <div>
                <p className="section-kicker">WISHLIST</p>
                <h2>Saved jobs</h2>
              </div>
              <span className="section-note">{wishlist.length} saved</span>
            </div>

            {wishlist.length === 0 ? (
              <p className="muted small">
                Save a job from the <Link to="/jobs">Jobs page</Link> to keep it here for later.
              </p>
            ) : (
              <ul className="saved-jobs-list">
                {wishlist.map((item) => (
                  <li key={item.id}>
                    <div className="saved-job-info">
                      <strong>{item.job.title}</strong>
                      <span className="muted small">
                        {item.job.company || 'Company'} · {item.job.city} · {item.job.experienceLevel} yr
                      </span>
                    </div>
                    <div className="job-actions">
                      <ApplyButton job={item.job} user={user} onApplied={handleAppliedFromWishlist} />
                      <SaveButton jobId={item.job.id} saved onToggle={handleRemovedFromWishlist} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
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