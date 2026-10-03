import { useEffect, useState } from 'react';
import { api, errorMessage } from '../api/client';
import { MAX_RESUME_BYTES } from '../utils/uploads';

function isValidLinkedInUrl(value) {
  if (!value) return true;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password || url.port
      || !['linkedin.com', 'www.linkedin.com'].includes(url.hostname.toLowerCase())) return false;
    const path = url.pathname.replace(/\/+$/, '');
    if (!path.startsWith('/in/')) return false;
    const slug = decodeURIComponent(path.slice('/in/'.length));
    return /^[\p{L}\p{N}][\p{L}\p{N}_-]{0,199}$/u.test(slug)
      && `https://www.linkedin.com/in/${encodeURIComponent(slug)}/`.length <= 500;
  } catch {
    return false;
  }
}

function parseCodingProfile(value) {
  const input = value.trim();
  const empty = { leetcode: '', codingProfileUrl: '' };
  if (!input) return empty;
  if (/^[a-zA-Z0-9._-]{1,120}$/.test(input)) return { ...empty, leetcode: input };
  if (input.length > 500) return null;

  try {
    const url = new URL(/^(?:www\.)?leetcode\.com\//i.test(input) ? `https://${input}` : input);
    const host = url.hostname.toLowerCase();
    const path = url.pathname.replace(/\/+$/, '');
    if (url.username || url.password || url.port) return null;

    if (['leetcode.com', 'www.leetcode.com'].includes(host)) {
      const profile = path.match(/^\/(?:(?:u|profile)\/)?([a-zA-Z0-9._-]{1,120})$/);
      return ['https:', 'http:'].includes(url.protocol) && profile
        ? { ...empty, leetcode: profile[1] }
        : null;
    }

    const profilePaths = {
      'hackerrank.com': /^\/(?:profile\/)?[\w-]{1,100}$/,
      'codeforces.com': /^\/profile\/[\w.-]{1,100}$/,
      'codechef.com': /^\/users\/[\w-]{1,100}$/,
    };
    const profilePath = profilePaths[host.replace(/^www\./, '')];
    return url.protocol === 'https:' && profilePath?.test(path)
      ? { ...empty, codingProfileUrl: input }
      : null;
  } catch {
    return null;
  }
}

export default function UploadForm({ onSubmit, loading, requestedRole }) {
  const [file, setFile] = useState(null);
  const [github, setGithub] = useState('');
  const [linkedinUrl, setLinkedinUrl] = useState('');
  const [linkedinSummaryText, setLinkedinSummaryText] = useState('');
  const [codingProfile, setCodingProfile] = useState('');
  const [codingSummaryText, setCodingSummaryText] = useState('');
  const [importingLinkedIn, setImportingLinkedIn] = useState(false);
  const [importNotice, setImportNotice] = useState('');
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
        if (available.length > 0) setRole(available.some((r) => r.id === requestedRole) ? requestedRole : available[0].id);
      })
      .catch((err) => {
        if (active) setRolesError(errorMessage(err));
      });
    return () => {
      active = false;
    };
  }, [requestedRole]);

  function handleFile(e) {
    const f = e.target.files?.[0] ?? null;
    setFile(f);
    setError('');
    if (f && !f.name.toLowerCase().endsWith('.pdf')) {
      setError('Only PDF resumes are accepted.');
    }
    if (f && f.size > MAX_RESUME_BYTES) {
      setError('Resume must be 4MB or smaller.');
    }
  }

  function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (!file) {
      setError('Choose a resume PDF first.');
      return;
    }
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      setError('Only PDF resumes are accepted.');
      return;
    }
    if (file.size > MAX_RESUME_BYTES) {
      setError('Resume must be 4MB or smaller.');
      return;
    }
    if (!role) {
      setError('Select a target role.');
      return;
    }
    if (!isValidLinkedInUrl(linkedinUrl.trim())) {
      setError('Enter a public HTTPS LinkedIn profile URL, such as https://www.linkedin.com/in/example-user/.');
      return;
    }
    if (linkedinSummaryText.trim().length > 10000) {
      setError('LinkedIn summary must be 10,000 characters or fewer.');
      return;
    }
    const parsedCodingProfile = parseCodingProfile(codingProfile);
    if (!parsedCodingProfile) {
      setError('Enter a LeetCode username or profile URL, or a public HTTPS HackerRank, Codeforces, or CodeChef profile URL.');
      return;
    }
    onSubmit(file, github.trim(), linkedinUrl.trim(), linkedinSummaryText.trim(), parsedCodingProfile.leetcode, role, { codingProfileUrl: parsedCodingProfile.codingProfileUrl, codingSummaryText: codingSummaryText.trim() });
  }

  async function importLinkedIn(event) {
    const pdf = event.target.files?.[0];
    if (!pdf) return;
    setError(''); setImportNotice('');
    if (!pdf.name.toLowerCase().endsWith('.pdf') || pdf.size > 4 * 1024 * 1024) { setError('Choose a LinkedIn PDF smaller than 4MB.'); return; }
    setImportingLinkedIn(true);
    try {
      const form = new FormData(); form.append('linkedin', pdf);
      const { data } = await api.post('/profile/linkedin-preview', form);
      setLinkedinSummaryText(data.text);
      setImportNotice(data.truncated ? 'The first 10,000 characters were imported. Review and edit the text below.' : 'PDF text imported. Review and edit it before submitting your profile.');
    } catch (err) { setError(errorMessage(err)); }
    finally { setImportingLinkedIn(false); event.target.value = ''; }
  }

  return (
    <form className="card student-upload-form" onSubmit={handleSubmit}>
      <div className="student-upload-heading"><span className="student-upload-icon" aria-hidden="true">01</span><div><p className="section-kicker">START WITH WHAT YOU HAVE</p><h2>Upload your profile</h2><p className="muted small">Your resume is the foundation. Add public profiles for more context.</p></div></div>

      <label className="student-file-field">
        Resume (PDF)
        <input className="student-file-input" type="file" accept=".pdf,application/pdf" onChange={handleFile} />
        <span className="muted small">{file ? `${file.name} · ${(file.size / 1024 / 1024).toFixed(2)} MB` : 'PDF only · up to 4MB'}</span>
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
        LinkedIn profile URL <span className="optional">(optional)</span>
        <input
          type="url"
          value={linkedinUrl}
          onChange={(e) => setLinkedinUrl(e.target.value)}
          placeholder="https://www.linkedin.com/in/example-user/"
        />
        <span className="muted small">URL only. Vortex does not scrape LinkedIn.</span>
      </label>

      <label>
        Import your LinkedIn profile PDF <span className="optional">(optional)</span>
        <input type="file" accept=".pdf,application/pdf" onChange={importLinkedIn} disabled={loading || importingLinkedIn} />
        <span className="muted small" role="status">{importingLinkedIn ? 'Reading the profile PDF…' : importNotice || 'Up to 4MB. The PDF fills the editable text field below; it is not stored.'}</span>
      </label>

      <label>
        LinkedIn About or profile text <span className="optional">(optional)</span>
        <textarea
          rows="4"
          maxLength="10000"
          value={linkedinSummaryText}
          onChange={(e) => setLinkedinSummaryText(e.target.value)}
          placeholder="Paste selected public profile text you want Vortex to consider."
        />
        <span className="muted small">User-provided text only · up to 10,000 characters.</span>
      </label>

      <label>
        Coding profile username or URL <span className="optional">(optional)</span>
        <input
          type="text"
          value={codingProfile}
          onChange={(e) => setCodingProfile(e.target.value)}
          placeholder="e.g. maayav or https://codeforces.com/profile/maayav"
          maxLength={500}
        />
        <span className="muted small">LeetCode username or a LeetCode, HackerRank, Codeforces, or CodeChef profile URL. One profile at a time.</span>
      </label>

      <label>
        Coding practice evidence <span className="optional">(optional)</span>
        <textarea rows={4} maxLength={10000} value={codingSummaryText} onChange={(e) => setCodingSummaryText(e.target.value)} placeholder="Paste your practice summary, solved problem names, languages, and what you learned." />
        <span className="muted small">This is labelled as user-provided evidence. HackerRank, Codeforces, and CodeChef are not fetched automatically.</span>
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

      <p className="muted small">GitHub and LeetCode lookups are supplementary and may be unavailable. LinkedIn is never fetched automatically.</p>

      <button className="primary" disabled={loading || importingLinkedIn || roles.length === 0}>
        {loading ? 'Uploading & extracting skills…' : 'Upload & extract skills'}
      </button>
    </form>
  );
}
