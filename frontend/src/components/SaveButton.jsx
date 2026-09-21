import { useState } from 'react';
import { api } from '../api/client';

export default function SaveButton({ jobId, saved, onToggle }) {
  const [busy, setBusy] = useState(false);

  async function toggle() {
    setBusy(true);
    try {
      if (saved) {
        await api.delete(`/wishlist/${jobId}`);
      } else {
        await api.post('/wishlist', { jobId });
      }
      onToggle?.(jobId, !saved);
    } catch {
      // Saving is best-effort; leave the current state untouched on failure.
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      className={`save-button${saved ? ' is-saved' : ''}`}
      onClick={toggle}
      disabled={busy}
      aria-pressed={saved}
    >
      {saved ? 'Saved' : 'Save'}
    </button>
  );
}