import { useCallback, useEffect, useState } from 'react';
import NavBar from '../components/NavBar';
import JobForm from '../components/JobForm';
import { api, errorMessage } from '../api/client';

export default function AdminJobsPage() {
  const [jobs, setJobs] = useState([]);
  const [editing, setEditing] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const LIMIT = 50;

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/jobs', { params: { page: 1, limit: LIMIT } });
      setJobs(res.data.jobs);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
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
      await load();
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
      setNotice('Job deleted.');
      setConfirmDelete(null);
      await load();
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
    <div className="page">
      <NavBar />
      <div className="page-title-row"><div><p className="section-kicker">HIRING WORKSPACE</p><h1>Manage opportunities.</h1><p className="muted">Keep your job postings up to date and ready for the right candidates.</p></div></div>

      {notice && <p className="notice">{notice}</p>}
      {error && <p className="error card-error">{error}</p>}

      <div className="card">
        <div className="job-head">
          <h2>Job postings ({jobs.length})</h2>
          {!editing && (
            <button className="primary" onClick={startCreate}>
              + Add a job
            </button>
          )}
        </div>
        <p className="muted small">Admins can edit or delete any posting.</p>
      </div>

      {editing && (
        <JobForm
          initial={editing.id ? editing : null}
          onSubmit={handleSubmit}
          onCancel={() => setEditing(null)}
          saving={saving}
        />
      )}

      {loading && <p className="muted">Loading jobs…</p>}

      {!loading && !error && jobs.length === 0 && !editing && (
        <div className="card center">
          <p className="muted">No job postings yet.</p>
        </div>
      )}

      {!loading && jobs.map((job) => (
        <div className="card job-card" key={job.id}>
          <div className="job-head">
            <div className="job-head-info">
              <h3>{job.title}</h3>
              <p className="muted small">
                {job.city} · {job.experienceLevel} yr{job.experienceLevel === 1 ? '' : 's'} experience · posted{' '}
                {new Date(job.createdAt).toLocaleDateString()}
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
                <strong>Delete this job posting?</strong> This cannot be undone.
              </p>
              <div className="filters-actions">
                <button className="primary danger-btn" disabled={saving} onClick={() => handleDelete(job.id)}>
                  {saving ? 'Deleting…' : 'Yes, delete'}
                </button>
                <button type="button" className="link" disabled={saving} onClick={() => setConfirmDelete(null)}>
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}