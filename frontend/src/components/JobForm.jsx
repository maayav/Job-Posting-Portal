import { useState } from 'react';
import { normalizeSkillName, duplicateNormalizedSkills } from '../utils/skills';
import SkillMultiSelect from './SkillMultiSelect';
import { useSkillOptions } from '../hooks/useSkillOptions';


export default function JobForm({ initial, onSubmit, onCancel, saving }) {
  const skillOptions = useSkillOptions();
  const [title, setTitle] = useState(initial?.title ?? '');
  const [company, setCompany] = useState(initial?.company ?? '');
  const [skills, setSkills] = useState(() => (initial?.skills ?? []).map(normalizeSkillName).filter(Boolean));
  const [experienceLevel, setExperienceLevel] = useState(initial?.experienceLevel ?? '');
  const [city, setCity] = useState(initial?.city ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [status, setStatus] = useState(initial?.status ?? 'open');
  const [error, setError] = useState('');

  function submit(e) {
    e.preventDefault();
    const skillList = skills.map(normalizeSkillName).filter(Boolean);

    if (!title.trim()) return setError('Title is required.');
    if (skillList.length === 0) return setError('At least one skill is required.');
    if (duplicateNormalizedSkills(skillList)) {
      return setError('Duplicate skills are not allowed (synonyms like "reactjs" and "React" count as the same skill).');
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
      company: company.trim(),
      skills: skillList,
      experienceLevel: exp,
      city: city.trim(),
      description: description.trim(),
      ...(initial?.id ? { status } : {}),
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
          Company <span className="optional">(optional)</span>
          <input value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Example Company" />
        </label>
        <label>
          Skills
          <SkillMultiSelect
            id="job-form-skills"
            label="Select skills"
            value={skills}
            onChange={setSkills}
            options={skillOptions}
          />
        </label>
        <p className="muted small field-hint">
          Pick several skills at once from the list, or type a custom skill and press Enter.
          Common synonyms (reactjs, nodejs, ui/ux, …) are normalized automatically.
        </p>
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
        {initial?.id && <label>
          Posting status
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="open">Open — accepting applications</option>
            <option value="closed">Closed — keep history, stop applications</option>
            <option value="archived">Archived — hide from candidates</option>
          </select>
        </label>}
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
