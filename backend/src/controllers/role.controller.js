import { SkillOntology } from '../models/skillOntology.js';
import { roleLabel, sortRoles } from '../config/roles.js';

// GET /api/roles — the available target roles, derived from the SkillOntology
// collection (the single source of truth). Adding a role to the ontology seed
// makes it appear here (and in the UI) without any code change.
export async function listRoles(req, res) {
  const names = await SkillOntology.distinct('roles.role_name');
  const roles = sortRoles(names).map((id) => ({ id, label: roleLabel(id) }));
  res.json({ roles });
}

export async function availableRoleNames() {
  return SkillOntology.distinct('roles.role_name');
}