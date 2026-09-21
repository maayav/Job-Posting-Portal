import { useState } from 'react';
import ApplyDialog from './ApplyDialog';

export default function ApplyButton({ job, user, onApplied }) {
  const [open, setOpen] = useState(false);

  function handleApplied(jobId) {
    setOpen(false);
    onApplied?.(jobId);
  }

  return (
    <span className="apply-wrap">
      <button className="apply-button" onClick={() => setOpen(true)}>
        Apply
      </button>
      {open && (
        <ApplyDialog job={job} user={user} onClose={() => setOpen(false)} onApplied={handleApplied} />
      )}
    </span>
  );
}