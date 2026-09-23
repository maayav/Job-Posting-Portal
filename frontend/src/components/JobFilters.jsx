import { useState } from 'react';
import { normalizeSkillName } from '../utils/skills';
import { motion } from 'motion/react';
import SkillMultiSelect from './SkillMultiSelect';

const POPULAR_SKILLS = [
  'Large Language Models', 'Retrieval-Augmented Generation', 'Prompt Engineering',
  'Vector Databases', 'LLM Evaluation', 'Fine-tuning', 'AI Safety',
  'FastAPI', 'Python', 'Django', 'TypeScript', 'PostgreSQL', 'Redis',
  'AWS', 'Docker', 'Kubernetes', 'GraphQL', 'PyTorch', 'TensorFlow',
  'React', 'Node.js', 'UI/UX', 'Flask', 'Spring Boot', '.NET', 'Go',
  'Java', 'SQL', 'MongoDB', 'Azure', 'GCP', 'Terraform', 'Jest', 'Cypress',
  'React Native', 'Vue', 'Angular', 'Next.js', 'JavaScript', 'C#', 'C++',
  'Playwright', 'Selenium', 'pytest', 'Postman', 'REST APIs', 'gRPC',
  'Power BI', 'Apache Spark', 'Airflow', 'OpenCV', 'Transformers',
  'Prometheus', 'Grafana', 'Firebase', 'Data Visualization', 'Networking',
];

export default function JobFilters({ onSearch, onClear, loading, initialFilters = {} }) {
  const [selectedSkills, setSelectedSkills] = useState(() => initialFilters.skills ? initialFilters.skills.split(',').map(normalizeSkillName).filter(Boolean) : []);
  const [search, setSearch] = useState(initialFilters.search ?? '');
  const [sort, setSort] = useState(initialFilters.sort ?? 'newest');
  const [experience, setExperience] = useState(initialFilters.experience ?? '');
  const [city, setCity] = useState(initialFilters.city ?? '');
  const [error, setError] = useState('');

  function submit(e) {
    e.preventDefault();
    if (experience !== '' && (Number.isNaN(Number(experience)) || Number(experience) < 0)) {
      setError('Experience must be a number of years (0 or more).');
      return;
    }
    const submittedSkills = selectedSkills
      .filter(Boolean)
      .filter((skill, index, values) => values.findIndex((item) => item.toLowerCase() === skill.toLowerCase()) === index);
    setError('');
    onSearch({
      skills: submittedSkills.join(','),
      experience: experience.trim(),
      city: city.trim(),
      search: search.trim(),
      sort,
    });
  }

  function clear() {
    setSelectedSkills([]);
    setSearch('');
    setSort('newest');
    setExperience('');
    setCity('');
    setError('');
    onClear();
  }

  function addSkill(skill) {
    appendSkills([skill]);
  }

  function appendSkills(values) {
    setSelectedSkills((current) => {
      const next = [...current];
      values.map(normalizeSkillName).filter(Boolean).forEach((skill) => {
        if (!next.some((item) => item.toLowerCase() === skill.toLowerCase())) next.push(skill);
      });
      return next;
    });
  }

  return (
    <motion.form
      className="card job-filters student-job-filters"
      onSubmit={submit}
      initial={false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
    >
      <h2>Find jobs</h2>
      <div className="filters job-filter-search-row">
        <label>
          Search roles, companies, or skills
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="e.g. FastAPI, platform engineer, or Northstar" />
        </label>
        <label>
          Sort by
          <select value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="title">Role title</option>
          </select>
        </label>
      </div>
      <div className="filters">
        <label>
          Skills
          <SkillMultiSelect
            id="job-filter-skills"
            value={selectedSkills}
            onChange={setSelectedSkills}
            options={POPULAR_SKILLS}
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
      <div className="job-filter-suggestions" aria-label="Popular skills">
        <span>Quick add</span>
        {POPULAR_SKILLS.slice(0, 10).map((skill) => (
          <button type="button" className="job-filter-suggestion" key={skill} onClick={() => addSkill(skill)}>
            {skill}
          </button>
        ))}
      </div>
      <p className="muted small field-hint" id="skill-filter-help">
        Open the picker to select several skills at once, or quick-add a popular one. We’ll show roles requiring up to your experience level in your chosen city.
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
