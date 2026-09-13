import { useState } from 'react';

export default function UploadForm({ onSubmit, loading }) {
  const [file, setFile] = useState(null);
  const [github, setGithub] = useState('');
  const [role, setRole] = useState('SDE');
  const [error, setError] = useState('');

  function handleFile(e) {
    const f = e.target.files?.[0] ?? null;
    setFile(f);
    setError('');
    if (f && !f.name.toLowerCase().endsWith('.pdf')) {
      setError('Only PDF resumes are accepted.');
    }
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (!file) {
      setError('Choose a resume PDF first.');
      return;
    }
    if (error) return;
    onSubmit(file, github.trim(), role);
  }

  return (
    <form className="card" onSubmit={handleSubmit}>
      <h2>Upload your profile</h2>

      <label>
        Resume (PDF)
        <input type="file" accept=".pdf,application/pdf" onChange={handleFile} />
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
        Target role
        <select value={role} onChange={(e) => setRole(e.target.value)}>
          <option value="SDE">Software Development Engineer</option>
          <option value="ML Engineer">ML Engineer</option>
        </select>
      </label>

      {error && <p className="error">{error}</p>}

      <button className="primary" disabled={loading}>
        {loading ? 'Uploading & extracting skills…' : 'Upload & extract skills'}
      </button>
    </form>
  );
}