export default function ExtractedSkillReview({ skills, extractionError }) {
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
          <div className="skill-card" key={`${s.name}-${i}`}>
            <div className="skill-head">
              <strong>{s.name}</strong>
              <span className={`badge badge-${s.confidence}`}>{s.confidence}</span>
            </div>
            <div className="sources">{s.sources.join(' + ') || 'resume'}</div>
            {s.evidence?.length > 0 && (
              <ul className="evidence">
                {s.evidence.map((ev, j) => (
                  <li key={j}>
                    <span className="src-tag">{ev.source}</span> “{ev.text}”
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
