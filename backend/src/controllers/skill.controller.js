import { SkillOntology } from '../models/skillOntology.js';
import { ResourceCatalog } from '../models/resourceCatalog.js';
import { env } from '../config/env.js';

const CACHE_TTL_MS = 5 * 60 * 1000;
let skillsCache = { at: 0, skills: [] };

// GET /api/skills — canonical skill keywords for search filters and job forms.
// Derived from the ontology plus the curated resource catalog so the lists stay
// in sync with whatever the analysis engine knows about.
export async function listSkills(req, res) {
  const useCache = env.NODE_ENV !== 'test' && skillsCache.skills.length > 0 && Date.now() - skillsCache.at <= CACHE_TTL_MS;
  if (!useCache) {
    const [ontologySkills, catalogSkills] = await Promise.all([
      SkillOntology.distinct('skill_name'),
      ResourceCatalog.distinct('skill_name'),
    ]);
    const names = [...new Set([...ontologySkills, ...catalogSkills])]
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b));
    skillsCache = { at: Date.now(), skills: names };
  }
  res.set('Cache-Control', 'private, max-age=300');
  res.json({ skills: skillsCache.skills });
}
