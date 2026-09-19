import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import NavBar from '../components/NavBar';
import { api, errorMessage } from '../api/client';
import { APPLICATION_STATUSES, PIPELINE_ORDER, STATUS_LABELS } from '../utils/statuses';
import '../styles/admin-experience.css';

const LIMIT = 20;

function SummaryCard({ label, value, tone = '', reduceMotion, index }) {
  return (
    <motion.div
      layout={!reduceMotion}
      initial={false}
      animate={{ opacity: 1, y: 0 }}
      whileHover={reduceMotion ? undefined : { y: -1 }}
      transition={{ duration: reduceMotion ? 0 : 0.16, delay: reduceMotion ? 0 : index * 0.025, ease: 'easeOut' }}
      className={`summary-card ${tone}`}
    >
      <span>{label}</span>
      <strong>{value ?? 0}</strong>
    </motion.div>
  );
}

export default function AdminApplicationsPage() {
  const reduceMotion = useReducedMotion();
  const resetPanelScroll = useCallback((node) => {
    if (!node) return;
    node.scrollTop = 0;
    node.scrollLeft = 0;
  }, []);
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

      {error && <p className="error card-error" role="alert">{error}</p>}
      {actionError && <p className="error card-error" role="alert">{actionError}</p>}

      <section className="application-summary-grid" aria-label="Application summary">
        <SummaryCard label="Total applications" value={summaryLoading ? '—' : totals.totalApplications} tone="summary-total" reduceMotion={reduceMotion} index={0} />
        <SummaryCard label="Under review" value={summaryLoading ? '—' : totals.underReview} reduceMotion={reduceMotion} index={1} />
        <SummaryCard label="Shortlisted" value={summaryLoading ? '—' : totals.shortlisted} reduceMotion={reduceMotion} index={2} />
        <SummaryCard label="Interview scheduled" value={summaryLoading ? '—' : totals.interviewScheduled} reduceMotion={reduceMotion} index={3} />
        <SummaryCard label="Selected" value={summaryLoading ? '—' : totals.selected} reduceMotion={reduceMotion} index={4} />
        <SummaryCard label="Rejected" value={summaryLoading ? '—' : totals.rejected} reduceMotion={reduceMotion} index={5} />
      </section>

      <section className="card applications-by-job">
        <div className="section-heading">
          <div>
            <p className="section-kicker">01 / ROLE BREAKDOWN</p>
            <h2>Applications by job</h2>
          </div>
          <span className="section-note">{jobs.length} roles</span>
        </div>
        {summaryLoading ? <p className="muted" role="status">Loading role totals…</p> : (
          <div className="table-scroll" ref={resetPanelScroll}>
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
                {jobs.length === 0 && <tr><td colSpan="9"><span className="muted">No applications by role yet.</span></td></tr>}
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

        {loading && <p className="muted" role="status">Loading applications…</p>}
        {!loading && applications.length === 0 && <div className="admin-applications-empty"><strong>No applications found</strong><p className="muted">Adjust the filters or clear them to see the full candidate flow.</p></div>}

        {!loading && applications.length > 0 && (
          <div className="pipeline-board" ref={resetPanelScroll} tabIndex="0" aria-label="Scrollable candidate flow">
            {PIPELINE_ORDER.map((status) => (
              <div className={`pipeline-column pipeline-${status}`} key={status}>
                <div className="pipeline-column-header"><span>{STATUS_LABELS[status]}</span><strong>{grouped[status].length}</strong></div>
                <div className="pipeline-cards">
                  {grouped[status].map((application, index) => (
                    <motion.article
                      layout={!reduceMotion}
                      initial={false}
                      animate={{ opacity: 1, y: 0 }}
                      whileHover={reduceMotion ? undefined : { y: -1 }}
                      transition={{ duration: reduceMotion ? 0 : 0.16, delay: reduceMotion ? 0 : Math.min(index * 0.02, 0.1), ease: 'easeOut' }}
                      className="application-card"
                      key={application.id}
                    >
                      <div className="application-avatar" aria-hidden="true">{(application.applicant.name || '?').slice(0, 1).toUpperCase()}</div>
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
                    </motion.article>
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
