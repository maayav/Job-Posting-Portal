export default function ExtractedSkillReview({ skills, extractionError }) {
  if (extractionError) {
    return (
      <div className="card">
        <h2>Skill extraction</h2>
        <p className="error">
          Skills could not be extracted: {extractionError}. You can still analyze if skills were
          cached, otherwise re-upload.
        </p>
      </div>
    );
  }

  if (!skills?.length) return null;

  return (
    <div className="card">
      <h2>Extracted skills — review before scoring</h2>
      <div className="skill-grid">
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