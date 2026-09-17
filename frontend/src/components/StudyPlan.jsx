import { useState } from 'react';
import { api } from '../api/client';
import { safeExternalUrl } from '../utils/links';

export default function StudyPlan({ reportId, items, onToggle }) {
  const [busy, setBusy] = useState(null);

  async function toggle(itemId, skill) {
    setBusy(itemId);
    try {
      await api.patch(`/report/${reportId}/study-plan/${itemId}`);
      onToggle(itemId, skill);
    } catch {
      // ignore transient failures; user can retry
    } finally {
      setBusy(null);
    }
  }

  if (!items?.length) {
    return (
      <div className="card">
        <p className="section-kicker">03 / NEXT MOVES</p>
        <h2>Study plan</h2>
        <p className="muted">No gaps found — no study items needed. Keep it up!</p>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="section-heading">
        <div>
          <p className="section-kicker">03 / NEXT MOVES</p>
          <h2>Prioritized study plan</h2>
        </div>
        <span className="section-note">{items.filter((item) => !item.done).length} open</span>
      </div>
      <ul className="plan-list">
        {items.map((item) => (
          <li key={item._id} className={item.done ? 'done' : ''}>
            <label className="plan-item">
              <input
                type="checkbox"
                checked={!!item.done}
                disabled={busy === item._id}
                onChange={() => toggle(item._id, item.skill)}
              />
              <span className="plan-body">
                <span className="plan-title">
                  {item.skill}
                  {item.priority >= 0.75 && <span className="badge badge-high">high priority</span>}
                </span>
                <span className="plan-resources">
                  {item.resources.map((r) => {
                    const url = safeExternalUrl(r.url);
                    return url ? <a key={r.url} href={url} target="_blank" rel="noreferrer">{r.title}</a> : null;
                  })}
                  {item.resources.length === 0 && <em>No curated resources yet</em>}
                </span>
                {item.reason && <span className="muted small plan-explanation">{item.reason}</span>}
                {item.learningObjectives?.length > 0 && <span className="plan-explanation small">Learn: {item.learningObjectives.join(' · ')}</span>}
                {item.projectRecommendations?.length > 0 && <span className="plan-explanation small">Practice project: {item.projectRecommendations.join(' · ')}</span>}
              </span>
            </label>
          </li>
        ))}
      </ul>
    </div>
  );
}
