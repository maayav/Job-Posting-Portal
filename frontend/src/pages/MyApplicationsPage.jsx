import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import NavBar from '../components/NavBar';
import { STATUS_LABELS } from '../utils/statuses';
import { api, errorMessage } from '../api/client';

export default function MyApplicationsPage() {
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .get('/applications/me')
      .then((res) => setApplications(res.data.applications ?? []))
      .catch((err) => setError(errorMessage(err)))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="page">
      <NavBar />

      <div className="page-title-row">
        <div>
          <p className="section-kicker">MY APPLICATIONS</p>
          <h1>Your applications</h1>
        </div>
        <Link className="landing-text-link" to="/jobs">← Browse more jobs</Link>
      </div>

      {error && <p className="error card-error">{error}</p>}
      {loading && <p className="muted">Loading your applications…</p>}

      {!loading && !error && applications.length === 0 && (
        <div className="card center">
          <h2>No applications yet</h2>
          <p className="muted">Find a role and hit Apply to start tracking it here.</p>
          <Link to="/jobs" className="primary inline">Browse jobs</Link>
        </div>
      )}

      {!loading && applications.length > 0 && (
        <div className="app-list">
          {applications.map((application) => (
            <div className="card app-row" key={application.id}>
              <div className="job-head">
                <div className="job-head-info">
                  <h3>{application.job.title}</h3>
                  <p className="muted small">
                    {application.job.company || 'Company'} · {application.job.city} · {application.job.experienceLevel} yr
                  </p>
                </div>
                <span className={`status-badge status-${application.status}`}>
                  {STATUS_LABELS[application.status] ?? application.status}
                </span>
              </div>
              <p className="muted small">
                Applied {new Date(application.appliedAt).toLocaleDateString()}
                {application.coverLetter ? ' · cover letter included' : ''}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}