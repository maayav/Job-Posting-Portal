import { useEffect, useState } from 'react';
import { api, errorMessage } from '../api/client';

export default function UploadForm({ onSubmit, loading }) {
  const [file, setFile] = useState(null);
  const [github, setGithub] = useState('');
  const [leetcode, setLeetcode] = useState('');
  const [roles, setRoles] = useState([]);
  const [role, setRole] = useState('');
  const [rolesError, setRolesError] = useState('');
  const [error, setError] = useState('');

  // Roles come from the backend (SkillOntology) — no hard-coded subset.
  useEffect(() => {
    let active = true;
    api
      .get('/roles')
      .then((res) => {
        if (!active) return;
        const available = res.data.roles ?? [];
        setRoles(available);
        if (available.length > 0) setRole(available[0].id);
      })
      .catch((err) => {
        if (active) setRolesError(errorMessage(err));
      });
    return () => {
      active = false;
    };
  }, []);

  function handleFile(e) {
    const f = e.target.files?.[0] ?? null;
    setFile(f);
    setError('');
    if (f && !f.name.toLowerCase().endsWith('.pdf')) {
      setError('Only PDF resumes are accepted.');
    }
    if (f && f.size > 5 * 1024 * 1024) {
      setError('Resume must be 5MB or smaller.');
    }
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (!file) {
      setError('Choose a resume PDF first.');
      return;
    }
    if (!role) {
      setError('Select a target role.');
      return;
    }
    if (error) return;
    onSubmit(file, github.trim(), leetcode.trim(), role);
  }

  return (
    <form className="card student-upload-form" onSubmit={handleSubmit}>
      <div className="student-upload-heading"><span className="student-upload-icon" aria-hidden="true">01</span><div><p className="section-kicker">START WITH WHAT YOU HAVE</p><h2>Upload your profile</h2><p className="muted small">Your resume is the foundation. Add public profiles for more context.</p></div></div>

      <label className="student-file-field">
        Resume (PDF)
        <input className="student-file-input" type="file" accept=".pdf,application/pdf" onChange={handleFile} />
        <span className="muted small">{file ? `${file.name} · ${(file.size / 1024 / 1024).toFixed(2)} MB` : 'PDF only · up to 5MB'}</span>
      </label>

      <label>
        GitHub username or profile URL <span className="optional">(optional)</span>
        <input
          type="text"
          value={github}
          onChange={(e) => setGithub(e.target.value)}
          placeholder="e.g. github.com/maayav or maayav"
        />
      </label>

      <label>
        LeetCode username or profile URL <span className="optional">(optional)</span>
        <input
          type="text"
          value={leetcode}
          onChange={(e) => setLeetcode(e.target.value)}
          placeholder="e.g. leetcode.com/u/maayav or maayav"
        />
      </label>

      <label>
        Target role
        <select value={role} onChange={(e) => setRole(e.target.value)} disabled={roles.length === 0}>
          {roles.length === 0 && <option value="">{rolesError ? 'Roles unavailable' : 'Loading roles…'}</option>}
          {roles.map((r) => (
            <option key={r.id} value={r.id}>
              {r.label}
            </option>
          ))}
        </select>
      </label>

      {rolesError && <p className="error">Could not load target roles: {rolesError}</p>}
      {error && <p className="error">{error}</p>}

      <button className="primary" disabled={loading || roles.length === 0}>
        {loading ? 'Uploading & extracting skills…' : 'Upload & extract skills'}
      </button>
    </form>
  );
}
