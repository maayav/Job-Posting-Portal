// Display labels for target roles. Keys must match the role_name values stored
// in SkillOntology (the source of truth for which roles exist). Roles present in
// the ontology but missing here fall back to their raw id, so adding a role to
// the seed data requires no code change.
export const ROLE_LABELS = {
  SDE: 'Software Development Engineer',
  'ML Engineer': 'ML Engineer',
};

export function roleLabel(roleName) {
  return ROLE_LABELS[roleName] ?? roleName;
}

// Preferred display order; roles not listed here are sorted alphabetically after.
export function sortRoles(roleNames) {
  const order = Object.keys(ROLE_LABELS);
  return [...roleNames].sort((a, b) => {
    const ia = order.indexOf(a);
    const ib = order.indexOf(b);
    if (ia !== -1 && ib !== -1) return ia - ib;
    if (ia !== -1) return -1;
    if (ib !== -1) return 1;
    return a.localeCompare(b);
  });
}