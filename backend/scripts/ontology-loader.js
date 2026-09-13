import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

export function loadOntologyFiles() {
  const files = ['sde.json', 'ml-engineer.json'];
  const byName = new Map();

  for (const file of files) {
    const data = JSON.parse(fs.readFileSync(path.join(ROOT, 'ontology', file), 'utf8'));
    for (const skill of data.skills) {
      const existing = byName.get(skill.skill_name);
      if (!existing) {
        byName.set(skill.skill_name, {
          skill_name: skill.skill_name,
          category: skill.category,
          roles: [...skill.roles],
        });
        continue;
      }
      for (const role of skill.roles) {
        if (!existing.roles.some((r) => r.role_name === role.role_name)) {
          existing.roles.push(role);
        }
      }
    }
  }

  return [...byName.values()];
}

export function loadResourceEntries() {
  const data = JSON.parse(fs.readFileSync(path.join(ROOT, 'resources', 'resources.json'), 'utf8'));
  return data.resources;
}