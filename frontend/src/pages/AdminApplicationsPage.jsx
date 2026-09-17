import { useCallback, useEffect, useMemo, useState } from 'react';
import NavBar from '../components/NavBar';
import { api, errorMessage } from '../api/client';
import { APPLICATION_STATUSES, PIPELINE_ORDER, STATUS_LABELS } from '../utils/statuses';

const LIMIT = 20;

function SummaryCard({ label, value, tone = '' }) {
  return (
    <div className={`summary-card ${tone}`}>
      <span>{label}</span>
      <strong>{value ?? 0}</strong>
    </div>
  );
}

export default function AdminApplicationsPage() {
  const [summary, setSummary] = useState(null);
  const [applications, setApplications] = useState([]);
  const [filters, setFilters] = useState({ search: '', jobId: '', status: '' });
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [changing, setChanging] = useState(null);

  const loadSummary = useCallback(async () => {
    setSummaryLoading(true);
    try {
      const res = await api.get('/admin/dashboard/application-summary');
      setSummary(res.data);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSummaryLoading(false);
    }
  }, []);

  const loadApplications = useCallback(async (nextFilters, nextPage) => {
    setLoading(true);
    setError('');
    try {
      const params = { page: nextPage, limit: LIMIT };
      if (nextFilters.search) params.search = nextFilters.search;
      if (nextFilters.jobId) params.jobId = nextFilters.jobId;
      if (nextFilters.status) params.status = nextFilters.status;
      const res = await api.get('/admin/applications', { params });
      setApplications(res.data.applications ?? []);
      setPage(res.data.page);
      setTotal(res.data.total);
      setTotalPages(res.data.totalPages);
    } catch (err) {
      setError(errorMessage(err));
      setApplications([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSummary();
    loadApplications({ search: '', jobId: '', status: '' }, 1);
  }, [loadApplications, loadSummary]);

  function applyFilters(next) {
    const nextFilters = { ...filters, ...next };
    setFilters(nextFilters);
    loadApplications(nextFilters, 1);
  }

  function clearFilters() {
    const nextFilters = { search: '', jobId: '', status: '' };
    setFilters(nextFilters);
    loadApplications(nextFilters, 1);
  }

  async function changeStatus(applicationId, status) {
    setChanging(applicationId);
    setActionError('');
    try {
      const res = await api.patch(`/admin/applications/${applicationId}/status`, { status });
      setApplications((current) => current.map((item) => (
        item.id === applicationId ? res.data.application : item
      )));
      await loadSummary();
    } catch (err) {
      setActionError(errorMessage(err));
    } finally {
      setChanging(null);
    }
  }

  const grouped = useMemo(() => {
    const groups = Object.fromEntries(PIPELINE_ORDER.map((status) => [status, []]));
    for (const application of applications) {
      if (groups[application.status]) groups[application.status].push(application);
    }
    return groups;
  }, [applications]);

  const totals = summary?.totals ?? {};
  const jobs = summary?.applicationsByJob ?? [];

  return (
    <div className="page admin-applications-page">
      <NavBar />

      <div className="page-title-row">
        <div>
          <p className="section-kicker">ADMIN / CANDIDATE FLOW</p>
          <h1>Applications</h1>
          <p className="muted">Review applications and track each candidate’s progress.</p>
        </div>
      </div>

      {error && <p className="error card-error">{error}</p>}
      {actionError && <p className="error card-error">{actionError}</p>}

      <section className="application-summary-grid" aria-label="Application summary">
        <SummaryCard label="Total applications" value={summaryLoading ? '—' : totals.totalApplications} tone="summary-total" />
        <SummaryCard label="Under review" value={summaryLoading ? '—' : totals.underReview} />
        <SummaryCard label="Shortlisted" value={summaryLoading ? '—' : totals.shortlisted} />
        <SummaryCard label="Interview scheduled" value={summaryLoading ? '—' : totals.interviewScheduled} />
        <SummaryCard label="Selected" value={summaryLoading ? '—' : totals.selected} />
        <SummaryCard label="Rejected" value={summaryLoading ? '—' : totals.rejected} />
      </section>

      <section className="card applications-by-job">
        <div className="section-heading">
          <div>
            <p className="section-kicker">01 / ROLE BREAKDOWN</p>
            <h2>Applications by job</h2>
          </div>
          <span className="section-note">{jobs.length} roles</span>
        </div>
        {summaryLoading ? <p className="muted">Loading role totals…</p> : (
          <div className="table-scroll">
            <table className="applications-table">
              <thead>
                <tr>
                  <th>Role</th><th>Total</th><th>Applied</th><th>Review</th><th>Shortlisted</th><th>Interview</th><th>Selected</th><th>Rejected</th><th />
                </tr>
              </thead>
              <tbody>
                {jobs.map((job) => (
                  <tr key={job.jobId}>
                    <td><strong>{job.jobTitle}</strong><small>{job.company || 'Company'}</small></td>
                    <td>{job.applicationCount}</td>
                    <td>{job.statusCounts.applied}</td>
                    <td>{job.statusCounts.under_review}</td>
                    <td>{job.statusCounts.shortlisted}</td>
                    <td>{job.statusCounts.interview_scheduled}</td>
                    <td>{job.statusCounts.selected}</td>
                    <td>{job.statusCounts.rejected}</td>
                    <td><button className="link" onClick={() => applyFilters({ jobId: job.jobId })}>View</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="card application-pipeline-section">
        <div className="section-heading">
          <div>
            <p className="section-kicker">02 / PIPELINE</p>
            <h2>Candidate flow</h2>
          </div>
          <span className="section-note">{total} total records</span>
        </div>

        <div className="application-filters">
          <input
            aria-label="Search applicants"
            placeholder="Search name or email"
            value={filters.search}
            onChange={(e) => setFilters((current) => ({ ...current, search: e.target.value }))}
            onKeyDown={(e) => { if (e.key === 'Enter') applyFilters({ search: e.currentTarget.value }); }}
          />
          <select aria-label="Filter by job" value={filters.jobId} onChange={(e) => applyFilters({ jobId: e.target.value })}>
            <option value="">All jobs</option>
            {jobs.map((job) => <option key={job.jobId} value={job.jobId}>{job.jobTitle}</option>)}
          </select>
          <select aria-label="Filter by status" value={filters.status} onChange={(e) => applyFilters({ status: e.target.value })}>
            <option value="">All statuses</option>
            {APPLICATION_STATUSES.map((status) => <option key={status} value={status}>{STATUS_LABELS[status]}</option>)}
          </select>
          <button className="link" onClick={clearFilters}>Clear</button>
        </div>

        {loading && <p className="muted">Loading applications…</p>}
        {!loading && applications.length === 0 && <p className="muted">No applications match these filters.</p>}

        {!loading && applications.length > 0 && (
          <div className="pipeline-board">
            {PIPELINE_ORDER.map((status) => (
              <div className={`pipeline-column pipeline-${status}`} key={status}>
                <div className="pipeline-column-header"><span>{STATUS_LABELS[status]}</span><strong>{grouped[status].length}</strong></div>
                <div className="pipeline-cards">
                  {grouped[status].map((application) => (
                    <article className="application-card" key={application.id}>
                      <div className="application-avatar">{(application.applicant.name || '?').slice(0, 1).toUpperCase()}</div>
                      <strong>{application.applicant.name || 'Unknown applicant'}</strong>
                      <span>{application.applicant.email}</span>
                      <small>{application.job.title}</small>
                      {application.job.company && <small>{application.job.company}</small>}
                      <small>Applied {new Date(application.appliedAt).toLocaleDateString()}</small>
                      <select
                        aria-label={`Change status for ${application.applicant.name || 'applicant'}`}
                        value={application.status}
                        disabled={changing === application.id}
                        onChange={(e) => changeStatus(application.id, e.target.value)}
                      >
                        {APPLICATION_STATUSES.map((option) => <option key={option} value={option}>{STATUS_LABELS[option]}</option>)}
                      </select>
                    </article>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {totalPages > 1 && (
          <div className="pagination">
            <button className="primary" disabled={page <= 1} onClick={() => loadApplications(filters, page - 1)}>← Previous</button>
            <span className="muted">Page {page} of {totalPages}</span>
            <button className="primary" disabled={page >= totalPages} onClick={() => loadApplications(filters, page + 1)}>Next →</button>
          </div>
        )}
      </section>
    </div>
  );
}
