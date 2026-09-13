import { useState } from 'react';
import { api } from '../api/client';

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
        <h2>Study plan</h2>
        <p className="muted">No gaps found — no study items needed. Keep it up!</p>
      </div>
    );
  }

  return (
    <div className="card">
      <h2>Prioritized study plan</h2>
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
                  {item.resources.map((r) => (
                    <a key={r.url} href={r.url} target="_blank" rel="noreferrer">
                      {r.title}
                    </a>
                  ))}
                  {item.resources.length === 0 && <em>No curated resources yet</em>}
                </span>
              </span>
            </label>
          </li>
        ))}
      </ul>
    </div>
  );
}