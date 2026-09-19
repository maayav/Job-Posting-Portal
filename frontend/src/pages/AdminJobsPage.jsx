import { useCallback, useEffect, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import NavBar from '../components/NavBar';
import JobForm from '../components/JobForm';
import { api, errorMessage } from '../api/client';
import '../styles/admin-experience.css';

export default function AdminJobsPage() {
  const reduceMotion = useReducedMotion();
  const [jobs, setJobs] = useState([]);
  const [editing, setEditing] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [total, setTotal] = useState(0);
  const LIMIT = 20;

  const load = useCallback(async (nextPage = 1) => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/jobs', { params: { page: nextPage, limit: LIMIT, includeStatus: true } });
      setJobs(res.data.jobs ?? []);
      setPage(res.data.page ?? nextPage);
      setTotalPages(res.data.totalPages ?? 0);
      setTotal(res.data.total ?? res.data.jobs?.length ?? 0);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(1);
  }, [load]);

  async function handleSubmit(payload) {
    setSaving(true);
    setError('');
    try {
      if (editing && editing.id) {
        await api.put(`/jobs/${editing.id}`, payload);
        setNotice('Job updated.');
      } else {
        await api.post('/jobs', payload);
        setNotice('Job created.');
      }
      setEditing(null);
      await load(page);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id) {
    setSaving(true);
    setError('');
    try {
      await api.delete(`/jobs/${id}`);
      setNotice('Posting removed or archived while preserving application history.');
      setConfirmDelete(null);
      await load(page);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  function startEdit(job) {
    setEditing(job);
    setNotice('');
  }

  function startCreate() {
    setEditing({});
    setNotice('');
  }

  return (
    <div className="page admin-jobs-page">
      <NavBar />
      <div className="page-title-row"><div><p className="section-kicker">HIRING WORKSPACE</p><h1>Manage opportunities.</h1><p className="muted">Keep your job postings up to date and ready for the right candidates.</p></div></div>

      {notice && <p className="notice">{notice}</p>}
      {error && <p className="error card-error">{error}</p>}

      <section className="card admin-jobs-toolbar" aria-label="Job posting tools">
        <div>
          <h2>Job postings <span>({total})</span></h2>
          <p className="muted">Manage the roles candidates can discover and apply for.</p>
        </div>
          {!editing && (
            <button className="primary" onClick={startCreate}>
              + Add a job
            </button>
          )}
      </section>

      {editing && (
        <JobForm
          key={editing.id || 'new-job'}
          initial={editing.id ? editing : null}
          onSubmit={handleSubmit}
          onCancel={() => setEditing(null)}
          saving={saving}
        />
      )}

      {loading && <p className="muted" role="status">Loading job postings…</p>}

      {!loading && !error && jobs.length === 0 && !editing && (
        <div className="card center">
          <p className="muted">No job postings yet.</p>
        </div>
      )}

      {!loading && jobs.length > 0 && <section className="admin-job-list" aria-label="Job postings">
      {jobs.map((job, index) => (
        <motion.article
          layout={!reduceMotion}
          initial={false}
          animate={{ opacity: 1, y: 0 }}
          whileHover={reduceMotion ? undefined : { y: -2 }}
          transition={{ duration: reduceMotion ? 0 : 0.18, delay: reduceMotion ? 0 : Math.min(index * 0.025, 0.15), ease: 'easeOut' }}
          className="card job-card admin-job-card"
          key={job.id}
        >
          <div className="job-head">
            <div className="job-head-info">
              {job.company && <p className="admin-job-company">{job.company}</p>}
              <h3>{job.title}</h3>
              <p className="admin-job-meta">
                <span>{job.city}</span>
                <span>{job.experienceLevel} yr{job.experienceLevel === 1 ? '' : 's'} experience</span>
                <span>Posted {new Date(job.createdAt).toLocaleDateString()}</span>
                <span className={`status-badge status-${job.status || 'open'}`}>{job.status === 'archived' ? 'Archived' : job.status === 'closed' ? 'Closed' : 'Open'}</span>
              </p>
            </div>
            <div className="job-actions">
              <button className="link" onClick={() => startEdit(job)}>Edit</button>
              <button className="link danger" onClick={() => setConfirmDelete(job.id)}>Delete</button>
            </div>
          </div>
          <div className="area-chips">
            {job.skills.map((skill) => (
              <span className="chip" key={skill}>
                {skill}
              </span>
            ))}
          </div>
          <p className="job-desc">{job.description}</p>

          {confirmDelete === job.id && (
            <div className="confirm-delete">
              <p>
                <strong>Remove this job posting?</strong> If it has applications, Vortex archives it so candidate history remains available; otherwise it is deleted.
              </p>
              <div className="filters-actions">
                <button className="primary danger-btn" disabled={saving} onClick={() => handleDelete(job.id)}>
                  {saving ? 'Removing…' : 'Yes, remove'}
                </button>
                <button type="button" className="link" disabled={saving} onClick={() => setConfirmDelete(null)}>
                  Cancel
                </button>
              </div>
            </div>
          )}
        </motion.article>
      ))}
      </section>}
      {!loading && totalPages > 1 && (
        <div className="pagination" aria-label="Job posting pages">
          <button className="primary" disabled={page <= 1} onClick={() => load(page - 1)}>← Previous</button>
          <span className="muted">Page {page} of {totalPages}</span>
          <button className="primary" disabled={page >= totalPages} onClick={() => load(page + 1)}>Next →</button>
        </div>
      )}
    </div>
  );
}
