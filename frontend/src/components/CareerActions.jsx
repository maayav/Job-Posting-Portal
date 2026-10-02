import { useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { safeExternalUrl } from '../utils/links';
import '../styles/profile-report.css';

export default function CareerActions({ actions }) {
  const [tab, setTab] = useState('projects');
  const [drafts, setDrafts] = useState(() => (actions?.posts ?? []).map((post) => post.draft));
  const [copyStatus, setCopyStatus] = useState('');
  const reduced = useReducedMotion();
  if (!actions) return null;
  async function copy(index) {
    try { await navigator.clipboard.writeText(drafts[index]); setCopyStatus('Draft copied. Check every claim before posting.'); }
    catch { setCopyStatus('Copy is unavailable here. Select the draft text and copy it manually.'); }
  }
  return <section className="card career-actions" aria-label="Career action plan">
    <p className="section-kicker">PUT THE PLAN INTO PRACTICE</p><h2>Build, practice, and share</h2><p className="muted small">{actions.note}</p>
    <div className="career-tabs" aria-label="Choose action type">{[['projects', 'Projects to build'], ['practice', 'Practice problems'], ['posts', 'LinkedIn ideas']].map(([id, label]) => <button key={id} type="button" aria-pressed={tab === id} onClick={() => setTab(id)}>{label}</button>)}</div>
    <motion.div key={tab} initial={reduced ? false : { opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .18 }}>
      {tab === 'projects' && <div className="career-action-grid">{actions.projects.map((project, index) => <article className="career-action" key={`${project.skill}-${index}`}><span className="section-kicker">{String(index + 1).padStart(2, '0')} / {project.skill}</span><h3>{project.title}</h3><p className="muted small">{project.reason}</p><h4>What to finish</h4><ul>{project.deliverables.map((item) => <li key={item}>{item}</li>)}</ul></article>)}</div>}
      {tab === 'practice' && <div className="career-action-grid">{actions.practice.length ? actions.practice.map((problem) => <article className="career-action" key={problem.id}><span className="section-kicker">{problem.platform} · {problem.difficulty}</span><h3>{problem.title}</h3><p className="muted small">{problem.reason}</p>{safeExternalUrl(problem.url) && <a href={problem.url} target="_blank" rel="noopener noreferrer">Open problem ↗</a>}</article>) : <p className="muted">There are no matching coding problems in the curated catalog for this role. Use the role-specific exercises and resources in your study plan.</p>}</div>}
      {tab === 'posts' && <div className="career-action-grid">{actions.posts.map((post, index) => <article className="career-action" key={`${post.skill}-${index}`}><span className="section-kicker">EDITABLE DRAFT · NOT PUBLISHED</span><h3>{post.title}</h3><ul>{post.outline.map((item) => <li key={item}>{item}</li>)}</ul><label>Post draft<textarea aria-label={`Post draft ${index + 1}`} rows={8} value={drafts[index] ?? ''} onChange={(event) => { setDrafts((current) => current.map((draft, i) => i === index ? event.target.value : draft)); setCopyStatus(''); }} /></label><button type="button" className="secondary" onClick={() => copy(index)}>Copy draft</button></article>)}</div>}
    </motion.div>
    <p role="status" className="muted small">{copyStatus}</p>
  </section>;
}
