import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import NavBar from '../components/NavBar';
import { STATUS_LABELS } from '../utils/statuses';
import { api, errorMessage } from '../api/client';
import Icon from '../components/Icon';
import '../styles/student-experience.css';

export default function MyApplicationsPage() {
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const inProgressCount = applications.filter((application) => ['applied', 'under_review', 'shortlisted', 'interview_scheduled'].includes(application.status)).length;
  const selectedCount = applications.filter((application) => application.status === 'selected').length;

  useEffect(() => {
    api
      .get('/applications/me')
      .then((res) => setApplications(res.data.applications ?? []))
      .catch((err) => setError(errorMessage(err)))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="page student-experience student-applications-page">
      <NavBar />

      <div className="page-title-row student-applications-heading">
        <div>
          <p className="section-kicker"><span className="signal-dot" /> MY APPLICATIONS</p>
          <h1>Your applications</h1>
          <p className="muted">A clear view of where each opportunity stands.</p>
        </div>
        <Link className="primary student-applications-browse" to="/jobs">Browse more jobs <Icon name="arrow" size={16} /></Link>
      </div>

      {!loading && !error && applications.length > 0 && <div className="student-application-summary" aria-label="Application overview"><div><span>Applications sent</span><strong>{applications.length}</strong></div><div><span>In progress</span><strong>{inProgressCount}</strong></div><div><span>Selected</span><strong>{selectedCount}</strong></div></div>}

      {error && <p className="error card-error">{error}</p>}
      {loading && <p className="muted">Loading your applications…</p>}

      {!loading && !error && applications.length === 0 && (
        <div className="card center student-empty-applications">
          <span className="student-empty-mark"><Icon name="briefcase" size={23} /></span>
          <h2>No applications yet</h2>
          <p className="muted">Find a role and hit Apply to start tracking it here.</p>
          <Link to="/jobs" className="primary inline">Browse jobs <Icon name="arrow" size={16} /></Link>
        </div>
      )}

      {!loading && applications.length > 0 && (
        <div className="app-list">
          {applications.map((application) => (
            <div className="card app-row student-application-card" key={application.id}>
              <div className="student-application-card-rail" aria-hidden="true"><Icon name="briefcase" size={17} /></div>
              <div className="job-head">
                <div className="job-head-info">
                  <h3>{application.job.title}</h3>
                  <p className="muted small">
                    {application.job.company || 'Company'} · {application.job.city} · {application.job.experienceLevel} yr{application.job.experienceLevel === 1 ? '' : 's'} experience
                  </p>
                </div>
                <span className={`status-badge status-${application.status}`}>
                  {STATUS_LABELS[application.status] ?? application.status}
                </span>
              </div>
              <p className="muted small student-application-date">
                <Icon name="check" size={14} />
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
