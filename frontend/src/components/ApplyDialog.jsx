import { useEffect, useState } from 'react';
import { api, errorMessage } from '../api/client';

export default function ApplyDialog({ job, user, onClose, onApplied }) {
  const [email, setEmail] = useState(user?.email ?? '');
  const [resumeMode, setResumeMode] = useState('profile');
  const [file, setFile] = useState(null);
  const [coverLetter, setCoverLetter] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    function onKeyDown(event) {
      if (event.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  async function submit(event) {
    event.preventDefault();
    if (!email.trim()) {
      setError('An email is required so the employer can reach you.');
      return;
    }
    if (resumeMode === 'upload' && !file) {
      setError('Choose a PDF resume to upload, or use your saved profile resume.');
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      const form = new FormData();
      form.append('jobId', job.id);
      form.append('email', email.trim());
      form.append('coverLetter', coverLetter.trim());
      if (resumeMode === 'upload' && file) {
        form.append('resume', file);
      } else if (resumeMode === 'profile') {
        form.append('useProfileResume', 'true');
      }

      await api.post('/applications', form);
      onApplied(job.id);
    } catch (err) {
      if (err.response?.status === 409) {
        onApplied(job.id);
        return;
      }
      setError(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="apply-overlay" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div className="card apply-dialog" role="dialog" aria-modal="true" aria-labelledby="apply-title">
        <div className="job-head">
          <div className="job-head-info">
            <p className="section-kicker">APPLY</p>
            <h2 id="apply-title">{job.title}</h2>
            <p className="muted small">{job.company || 'Company'} · {job.city}</p>
          </div>
          <button type="button" className="link" onClick={onClose}>Close</button>
        </div>

        <form onSubmit={submit}>
          <label>
            Contact email
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              required
            />
          </label>

          <fieldset className="apply-resume">
            <legend>Resume</legend>
            <label className="apply-choice">
              <input
                type="radio"
                name="resume-mode"
                value="profile"
                checked={resumeMode === 'profile'}
                onChange={() => setResumeMode('profile')}
              />
              <span>
                Use my saved profile resume
                <small>We reuse the resume from your latest analysis — nothing to upload.</small>
              </span>
            </label>
            <label className="apply-choice">
              <input
                type="radio"
                name="resume-mode"
                value="upload"
                checked={resumeMode === 'upload'}
                onChange={() => setResumeMode('upload')}
              />
              <span>
                Upload a different resume
                <small>PDF only, up to 5 MB. This one is attached to this application.</small>
              </span>
            </label>
            {resumeMode === 'upload' && (
              <input
                type="file"
                accept=".pdf,application/pdf"
                onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              />
            )}
            <label className="apply-choice">
              <input
                type="radio"
                name="resume-mode"
                value="none"
                checked={resumeMode === 'none'}
                onChange={() => setResumeMode('none')}
              />
              <span>
                Apply without a resume
                <small>Your profile and cover note are still shared with the placement team.</small>
              </span>
            </label>
          </fieldset>

          <label>
            Cover note <span className="optional">(optional)</span>
            <textarea
              rows="3"
              value={coverLetter}
              onChange={(event) => setCoverLetter(event.target.value)}
              placeholder="A short note for the placement team"
            />
          </label>

          {error && <p className="error">{error}</p>}

          <div className="filters-actions">
            <button className="primary" disabled={submitting}>
              {submitting ? 'Submitting…' : 'Submit application'}
            </button>
            <button type="button" className="link" onClick={onClose} disabled={submitting}>Cancel</button>
          </div>
        </form>
      </div>
    </div>
  );
}