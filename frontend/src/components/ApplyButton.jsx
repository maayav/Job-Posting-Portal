import { useState } from 'react';
import { api, errorMessage } from '../api/client';

export default function ApplyButton({ jobId }) {
  const [state, setState] = useState('idle'); // idle | applied | applying | error
  const [error, setError] = useState('');

  async function apply() {
    setState('applying');
    setError('');
    try {
      await api.post('/applications', { jobId });
      setState('applied');
    } catch (err) {
      if (err.response?.status === 409) {
        setState('applied'); // already applied — treat as applied
      } else {
        setError(errorMessage(err));
        setState('error');
      }
    }
  }

  if (state === 'applied') {
    return (
      <span className="badge badge-applied" role="status">
        Applied
      </span>
    );
  }

  return (
    <span className="apply-wrap">
      <button className="apply-button" onClick={apply} disabled={state === 'applying'}>
        {state === 'applying' ? 'Applying…' : 'Apply'}
      </button>
      {state === 'error' && <span className="error small apply-error">{error}</span>}
    </span>
  );
}