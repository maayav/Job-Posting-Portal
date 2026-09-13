import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import UploadForm from '../components/UploadForm';
import ExtractedSkillReview from '../components/ExtractedSkillReview';
import { useAuth } from '../context/AuthContext';
import { api, errorMessage } from '../api/client';

const POLL_MS = 4000;

export default function UploadPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [phase, setPhase] = useState('upload'); // upload | review | analyzing
  const [submission, setSubmission] = useState(null);
  const [skills, setSkills] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleUpload(file, github, role) {
    setError('');
    setLoading(true);
    setPhase('upload');
    try {
      const form = new FormData();
      form.append('resume', file);
      form.append('github_username', github);
      form.append('target_role', role);

      const res = await api.post('/profile', form);
      const submissionId = res.data.id;

      const profile = await api.get(`/profile/${submissionId}`);
      setSubmission(profile.data);
      setSkills(profile.data.extracted_skills ?? []);
      setPhase('review');
      if (res.data.extraction_status === 'failed') {
        setError(`Skill extraction failed (${res.data.extraction_error}). Re-upload may be needed.`);
      }
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  async function handleAnalyze() {
    setError('');
    setPhase('analyzing');
    try {
      const res = await api.post('/analyze', { submission_id: submission.id });
      const id = res.data.report_id;

      if (res.status === 202 && res.data.status === 'completed') {
        localStorage.setItem('report_id', id);
        navigate('/dashboard');
        return;
      }

      await poll(id);
    } catch (err) {
      if (err.response?.status === 429) {
        const data = err.response.data;
        setError(`${data.message} (retry in ${data.retryAfterSeconds}s).`);
      } else {
        setError(errorMessage(err));
      }
      setPhase('review');
    }
  }

  async function poll(id) {
    for (let i = 0; i < 40; i += 1) {
      await new Promise((r) => setTimeout(r, POLL_MS));
      const res = await api.get(`/analyze/${id}/status`);
      const status = res.data.status;
      if (status === 'completed') {
        localStorage.setItem('report_id', id);
        navigate('/dashboard');
        return;
      }
      if (status === 'failed') {
        setError(`Analysis failed: ${res.data.errorCode ?? 'unknown error'}.`);
        setPhase('review');
        return;
      }
    }
    setError('Analysis is taking too long. Please refresh and try again.');
    setPhase('review');
  }

  return (
    <div className="page">
      <header className="topbar">
        <div>
          <strong>SkillGap Tracker</strong>
        </div>
        <div className="topbar-user">
          <span>{user?.name} ({user?.role})</span>
          <button className="link" onClick={logout}>Log out</button>
        </div>
      </header>

      {phase === 'upload' && (
        <UploadForm onSubmit={handleUpload} loading={loading} />
      )}

      {phase === 'review' && (
        <>
          <ExtractedSkillReview skills={skills} extractionError={submission?.extraction_status === 'failed' ? submission?.extraction_error : null} />
          {error && <p className="error card-error">{error}</p>}
          <div className="actions card">
            <button className="primary" onClick={handleAnalyze}>
              Analyze &amp; score for {submission?.target_role}
            </button>
            <button className="link" onClick={() => setPhase('upload')}>
              Upload a different resume
            </button>
          </div>
        </>
      )}

      {phase === 'analyzing' && (
        <div className="card center">
          <div className="spinner" />
          <h2>Analyzing your profile…</h2>
          <p className="muted">Embedding skills, matching against the {submission?.target_role} ontology, and computing your readiness score.</p>
        </div>
      )}
    </div>
  );
}