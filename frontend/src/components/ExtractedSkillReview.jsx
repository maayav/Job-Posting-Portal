import { motion, useReducedMotion } from 'motion/react';

export default function ExtractedSkillReview({ skills, extractionError }) {
  const reduced = useReducedMotion();
  const label = (source) => ({ linkedin_user_provided: 'LinkedIn text', coding_user_provided: 'Coding profile text' }[source] || source);
  if (extractionError) {
    return (
      <div className="card student-extracted-review">
        <h2>Skill extraction</h2>
        <p className="error">
          Skills could not be extracted yet. Use Retry skill extraction below to try again with your saved resume.
        </p>
      </div>
    );
  }

  if (!skills?.length) return null;

  return (
    <div className="card student-extracted-review">
      <div className="student-extracted-heading"><div><p className="section-kicker">02 / PROFILE MAP</p><h2>Review your extracted skills</h2></div><span className="section-note">{skills.length} signals</span></div>
      <div className="skill-grid student-extracted-grid">
        {skills.map((s, i) => (
          <motion.div className="skill-card" key={`${s.name}-${i}`} initial={reduced ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .2, delay: reduced ? 0 : Math.min(i * .025, .25) }}>
            <div className="skill-head">
              <strong>{s.name}</strong>
              <span className={`badge badge-${s.confidence}`}>{s.confidence}</span>
            </div>
            <div className="sources">{s.sources.map(label).join(' + ') || 'resume'}</div>
            {s.evidence?.length > 0 && (
              <ul className="evidence">
                {s.evidence.map((ev, j) => (
                  <li key={j}>
                    <span className="src-tag">{label(ev.source)}</span> “{ev.text}”
                  </li>
                ))}
              </ul>
            )}
          </motion.div>
        ))}
      </div>
    </div>
  );
}
