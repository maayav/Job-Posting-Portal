import { motion, useReducedMotion } from 'motion/react';
import { safeExternalUrl } from '../utils/links';
import '../styles/profile-report.css';

const labels = { assessed: 'Assessed', partial: 'Partial data', user_provided: 'User-provided', not_provided: 'Not added', unavailable: 'Unavailable', link_only: 'URL only' };
const sourceNames = { resume: 'resume', github: 'GitHub', leetcode: 'LeetCode', coding_user_provided: 'coding profile text', linkedin_user_provided: 'LinkedIn text' };

export default function ProfileAssessment({ assessment, targetRole }) {
  const reduced = useReducedMotion();
  if (!assessment) return <div className="card"><h2>Your wider profile</h2><p className="muted">This older report has no source-by-source assessment. Start a new analysis to compare your resume, projects, coding practice, and profile text.</p></div>;
  return <section className="card profile-assessment" aria-label="Profile assessment">
    <div className="section-heading"><div><p className="section-kicker">YOUR EVIDENCE, IN ONE PLACE</p><h2>Overall profile score</h2><p className="muted">{targetRole} · {assessment.assessedSources} of {assessment.totalSources} sources assessed</p></div><div className="profile-overall"><strong>{assessment.score ?? '—'}</strong><span>/100</span></div></div>
    <p className="muted small">{assessment.summary}</p>
    <div className="profile-source-grid">
      {assessment.sources.map((source, index) => <motion.article className="profile-source" key={source.id} initial={reduced ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .25, delay: reduced ? 0 : Math.min(index * .05, .2) }}>
        <div className="profile-source-heading"><h3>{source.label}</h3><span className="chip">{labels[source.status] ?? source.status}</span></div>
        <div className="profile-source-score"><strong>{source.score ?? '—'}</strong><span>{source.score == null ? 'Not scored' : '/100'}</span></div>
        {source.score != null && <div className="profile-meter" role="img" aria-label={`${source.label}: ${source.score} out of 100`}><motion.span initial={{ scaleX: reduced ? source.score / 100 : 0 }} animate={{ scaleX: source.score / 100 }} transition={{ duration: reduced ? 0 : .6, delay: reduced ? 0 : .1 }} /></div>}
        <p className="muted small">{source.details?.[0]}</p>
        <details><summary>Evidence and scoring</summary><p className="small">{source.formula}</p>{source.details?.slice(1).map((detail) => <p className="muted small" key={detail}>{detail}</p>)}{source.matchedSkills?.length > 0 && <p className="small">Role skills: {source.matchedSkills.join(', ')}</p>}</details>
      </motion.article>)}
    </div>
    {assessment.crossSourceSkills?.length > 0 && <div className="profile-comparison"><h3>Skills appearing across sources</h3><p className="muted small">Agreement between sources adds context; self-reported text is not independent verification.</p><ul>{assessment.crossSourceSkills.map((item) => <li key={item.skill}><strong>{item.skill}</strong><span>{item.sources.map((source) => sourceNames[source] ?? source).join(' · ')}</span></li>)}</ul></div>}
    {assessment.resumeOnlySkills?.length > 0 && <p className="small"><strong>Currently supported only by the resume:</strong> {assessment.resumeOnlySkills.join(', ')}. A repository walkthrough or practice example could add context; absence elsewhere does not mean the skill is missing.</p>}
    {assessment.projects?.length > 0 && <details className="profile-repositories"><summary>Repositories included in this assessment ({assessment.projects.length})</summary><ul>{assessment.projects.map((project) => <li key={project.url}>{safeExternalUrl(project.url) && <a href={project.url} target="_blank" rel="noopener noreferrer">{project.name} ↗</a>}<p className="muted small">{project.description || 'No repository description.'} · {project.hasReadme ? 'README excerpt available' : 'No substantive README excerpt available'}</p></li>)}</ul></details>}
  </section>;
}
