import { SkillOntology } from '../models/skillOntology.js';
import { roleLabel, sortRoles } from '../config/roles.js';
import { env } from '../config/env.js';

const CACHE_TTL_MS = 5 * 60 * 1000;
let rolesCache = { at: 0, roles: [] };

// GET /api/roles — the available target roles, derived from the SkillOntology
// collection (the single source of truth). Adding a role to the ontology seed
// makes it appear here (and in the UI) without any code change.
export async function listRoles(req, res) {
  const useCache = env.NODE_ENV !== 'test' && rolesCache.roles.length > 0 && Date.now() - rolesCache.at <= CACHE_TTL_MS;
  if (!useCache) {
    const names = await SkillOntology.distinct('roles.role_name');
    rolesCache = { at: Date.now(), roles: sortRoles(names).map((id) => ({ id, label: roleLabel(id) })) };
  }
  res.set('Cache-Control', 'private, max-age=300');
  res.json({ roles: rolesCache.roles });
}

export async function availableRoleNames() {
  return SkillOntology.distinct('roles.role_name');
}

