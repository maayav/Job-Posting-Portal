import { useEffect, useState } from 'react';
import { api } from '../api/client';
import { SKILL_KEYWORDS } from '../utils/skills';

let cachedSkills = null;

// Skill keywords for filters and forms. Served by GET /api/skills (ontology +
// curated catalog) with a bundled fallback so the UI works before/without it.
export function useSkillOptions() {
  const [options, setOptions] = useState(cachedSkills ?? SKILL_KEYWORDS);

  useEffect(() => {
    if (cachedSkills) return undefined;
    let active = true;
    api.get('/skills')
      .then((res) => {
        const skills = (res.data.skills ?? []).filter((skill) => typeof skill === 'string' && skill.trim());
        if (skills.length) {
          cachedSkills = skills;
          if (active) setOptions(skills);
        }
      })
      .catch(() => {});
    return () => { active = false; };
  }, []);

  return options;
}
