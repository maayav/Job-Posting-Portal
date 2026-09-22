import { useState } from 'react';
import { api } from '../api/client';
import { safeExternalUrl } from '../utils/links';

export default function StudyPlan({ reportId, items, onToggle, title = 'Prioritized study plan', kicker = '03 / NEXT MOVES', note = null }) {
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState('');

  async function toggle(itemId, skill) {
    setBusy(itemId);
    setError('');
    try {
      await api.patch(`/report/${reportId}/study-plan/${itemId}`);
      onToggle(itemId, skill);
    } catch {
      setError('Could not save that change. Try again.');
    } finally {
      setBusy(null);
    }
  }

  if (!items?.length) {
    return (
      <div className="card">
        <p className="section-kicker">{kicker}</p>
        <h2>{title}</h2>
        <p className="muted">No gaps found — no study items needed. Keep it up!</p>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="section-heading">
        <div>
          <p className="section-kicker">{kicker}</p>
          <h2>{title}</h2>
        </div>
        <span className="section-note">{note ?? `${items.filter((item) => !item.done).length} open`}</span>
      </div>
      {error && <p className="error card-error" role="alert">{error}</p>}
      <ul className="plan-list">
        {items.map((item) => (
          <li key={item._id} className={item.done ? 'done' : ''}>
            <div className="plan-item">
              <input
                type="checkbox"
                checked={!!item.done}
                aria-label={`Mark ${item.skill} ${item.done ? 'incomplete' : 'complete'}`}
                disabled={busy !== null}
                onChange={() => toggle(item._id, item.skill)}
              />
              <span className="plan-body">
                <span className="plan-title">
                  {item.skill}
                  {item.priority >= 0.75 && <span className="badge badge-high">high priority</span>}
                </span>
                <span className="plan-resources">
                  {(item.resources ?? []).map((r) => {
                    const url = safeExternalUrl(r.url);
                    return url ? <a key={r.url} href={url} target="_blank" rel="noopener noreferrer"><span>{r.title}</span><small>{r.type === 'practice-set' ? 'Practice' : r.type} ↗</small></a> : null;
                  })}
                  {!item.resources?.length && <em>Resources for this skill are being curated.</em>}
                </span>
                {item.reason && <span className="muted small plan-explanation">{item.reason}</span>}
                {item.learningObjectives?.length > 0 && <span className="plan-explanation small">Learn: {item.learningObjectives.join(' · ')}</span>}
                {item.projectRecommendations?.length > 0 && <span className="plan-explanation small">Practice project: {item.projectRecommendations.join(' · ')}</span>}
                {item.practiceProblems?.length > 0 && <span className="plan-explanation small">Exercises: {item.practiceProblems.join(' · ')}</span>}
                {item.estimatedEffortHours > 0 && <span className="muted small plan-explanation">Suggested effort: {item.estimatedEffortHours} hours</span>}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
