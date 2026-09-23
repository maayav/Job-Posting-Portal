import { useEffect, useMemo, useRef, useState } from 'react';
import { normalizeSkillName } from '../utils/skills';

// Multi-select skill picker: choose any number of keywords at once from a
// checkbox panel instead of typing or picking them one by one.
export default function SkillMultiSelect({ value, onChange, options, label = 'Select skills', id }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const containerRef = useRef(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((skill) => skill.toLowerCase().includes(q));
  }, [options, query]);

  useEffect(() => {
    if (!open) return undefined;
    function onPointerDown(event) {
      if (!containerRef.current?.contains(event.target)) setOpen(false);
    }
    function onKeyDown(event) {
      if (event.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  function add(skill) {
    const normalized = normalizeSkillName(skill);
    if (!normalized) return;
    onChange(value.some((item) => item.toLowerCase() === normalized.toLowerCase()) ? value : [...value, normalized]);
  }

  function remove(skill) {
    onChange(value.filter((item) => item !== skill));
  }

  function toggle(skill) {
    if (value.includes(skill)) remove(skill);
    else add(skill);
  }

  function onSearchKeyDown(event) {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    if (query.trim()) {
      add(query);
      setQuery('');
    }
  }

  return (
    <div className="skill-multi" ref={containerRef}>
      <div className="skill-multi-chips" aria-label="Selected skills">
        {value.map((skill) => (
          <span className="job-filter-chip" key={skill}>
            {skill}
            <button type="button" aria-label={`Remove ${skill}`} onClick={() => remove(skill)}>×</button>
          </span>
        ))}
        <button
          type="button"
          id={id}
          className="skill-multi-add"
          aria-expanded={open}
          aria-haspopup="true"
          onClick={() => setOpen((current) => !current)}
        >
          {value.length ? '+ Add more' : label}
        </button>
      </div>

      {open && (
        <div className="skill-multi-panel">
          <input
            className="skill-multi-search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={onSearchKeyDown}
            placeholder="Search skills, or type one and press Enter"
            autoFocus
          />
          <div className="skill-multi-options">
            {filtered.map((skill) => (
              <label className="skill-multi-option" key={skill}>
                <input type="checkbox" checked={value.includes(skill)} onChange={() => toggle(skill)} />
                <span>{skill}</span>
              </label>
            ))}
            {!filtered.length && (
              <p className="muted small skill-multi-empty">
                {query.trim() ? `Press Enter to add “${query.trim()}”.` : 'No skills available.'}
              </p>
            )}
          </div>
          <div className="skill-multi-actions">
            <span className="muted small">{value.length} selected</span>
            <span>
              {value.length > 0 && <button type="button" className="link" onClick={() => onChange([])}>Clear</button>}
              <button type="button" className="link" onClick={() => setOpen(false)}>Done</button>
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
