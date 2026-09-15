import { useState } from 'react';

export default function JobForm({ initial, onSubmit, onCancel, saving }) {
  const [title, setTitle] = useState(initial?.title ?? '');
  const [skills, setSkills] = useState(initial?.skills?.join(', ') ?? '');
  const [experienceLevel, setExperienceLevel] = useState(initial?.experienceLevel ?? '');
  const [city, setCity] = useState(initial?.city ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [error, setError] = useState('');

  function submit(e) {
    e.preventDefault();
    const skillList = skills.split(',').map((s) => s.trim()).filter(Boolean);

    if (!title.trim()) return setError('Title is required.');
    if (skillList.length === 0) return setError('At least one skill is required.');
    const normalized = skillList.map((s) => s.toLowerCase());
    if (new Set(normalized).size !== normalized.length) {
      return setError('Duplicate skills are not allowed.');
    }
    const exp = Number(experienceLevel);
    if (experienceLevel === '' || Number.isNaN(exp) || exp < 0) {
      return setError('Experience must be a number of years (0 or more).');
    }
    if (!city.trim()) return setError('City is required.');
    if (!description.trim()) return setError('Description is required.');

    setError('');
    onSubmit({
      title: title.trim(),
      skills: skillList,
      experienceLevel: exp,
      city: city.trim(),
      description: description.trim(),
    });
  }

  return (
    <form className="card job-form" onSubmit={submit}>
      <h2>{initial ? 'Edit job' : 'Add a job'}</h2>
      <div className="filters">
        <label>
          Title
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Frontend Developer" />
        </label>
        <label>
          Skills (comma-separated)
          <input value={skills} onChange={(e) => setSkills(e.target.value)} placeholder="React, JavaScript" />
        </label>
        <label>
          Required experience (years)
          <input
            type="number"
            min="0"
            step="1"
            value={experienceLevel}
            onChange={(e) => setExperienceLevel(e.target.value)}
            placeholder="e.g. 2"
          />
        </label>
        <label>
          City
          <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Chennai" />
        </label>
      </div>
      <label>
        Description
        <textarea rows="4" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What will the role involve?" />
      </label>
      {error && <p className="error">{error}</p>}
      <div className="filters-actions">
        <button className="primary" disabled={saving}>
          {saving ? 'Saving…' : initial ? 'Save changes' : 'Create job'}
        </button>
        <button type="button" className="link" onClick={onCancel} disabled={saving}>
          Cancel
        </button>
      </div>
    </form>
  );
}