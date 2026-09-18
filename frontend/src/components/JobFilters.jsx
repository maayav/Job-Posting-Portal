import { useState } from 'react';
import { parseSkillsInput } from '../utils/skills';
import { motion } from 'motion/react';

export default function JobFilters({ onSearch, onClear, loading }) {
  const [skills, setSkills] = useState('');
  const [experience, setExperience] = useState('');
  const [city, setCity] = useState('');
  const [error, setError] = useState('');

  function submit(e) {
    e.preventDefault();
    if (experience !== '' && (Number.isNaN(Number(experience)) || Number(experience) < 0)) {
      setError('Experience must be a number of years (0 or more).');
      return;
    }
    setError('');
    onSearch({
      skills: parseSkillsInput(skills).join(','),
      experience: experience.trim(),
      city: city.trim(),
    });
  }

  function clear() {
    setSkills('');
    setExperience('');
    setCity('');
    setError('');
    onClear();
  }

  return (
    <motion.form
      className="card job-filters student-job-filters"
      onSubmit={submit}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
    >
      <h2>Find jobs</h2>
      <div className="filters">
        <label>
          Skills
          <input
            value={skills}
            onChange={(e) => setSkills(e.target.value)}
            placeholder="react, ui/ux, node.js"
          />
        </label>
        <label>
          Experience (years)
          <input
            type="number"
            min="0"
            step="1"
            value={experience}
            onChange={(e) => setExperience(e.target.value)}
            placeholder="e.g. 2"
          />
        </label>
        <label>
          City
          <input
            value={city}
            onChange={(e) => setCity(e.target.value)}
            placeholder="e.g. Chennai"
          />
        </label>
      </div>
      <p className="muted small field-hint">
        Separate skills with commas. We’ll show roles requiring up to your experience level in your chosen city.
      </p>
      {error && <p className="error">{error}</p>}
      <div className="filters-actions">
        <button className="primary" disabled={loading}>
          {loading ? 'Searching…' : 'Search'}
        </button>
        <button type="button" className="link" onClick={clear}>
          Clear filters
        </button>
      </div>
    </motion.form>
  );
}
