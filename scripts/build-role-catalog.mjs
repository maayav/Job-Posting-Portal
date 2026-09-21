import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { loadOntologyFiles, loadResourceEntries } from '../backend/scripts/ontology-loader.js';
import { normalizeSkillName } from '../backend/src/utils/skillNormalizer.js';
import { roleLabel, sortRoles } from '../backend/src/config/roles.js';

const entries = loadOntologyFiles();
const resources = loadResourceEntries().filter((r) => r.verified !== false && /^https:\/\//.test(r.url));
const normalize = (s) => normalizeSkillName(s).toLowerCase();
const names = sortRoles([...new Set(entries.flatMap((e) => e.roles.map((r) => r.role_name)))]);
const roles = names.map((id) => ({
  id, label: roleLabel(id),
  skills: entries.filter((e) => e.roles.some((r) => r.role_name === id)).map((e) => ({
    name: e.skill_name,
    category: e.category,
    weight: e.roles.find((r) => r.role_name === id).weight,
    resources: [...new Map(resources.filter((r) => normalize(r.skill_name) === normalize(e.skill_name))
      .map((r) => [r.url, { title: r.title, url: r.url }])).values()],
  })).sort((a, b) => b.weight - a.weight || a.name.localeCompare(b.name)),
}));
const output = new URL('../frontend/src/data/role-catalog.json', import.meta.url);
fs.mkdirSync(fileURLToPath(new URL('.', output)), { recursive: true });
fs.writeFileSync(output, JSON.stringify({ roles, skillCount: entries.length, resourceCount: new Set(resources.map((r) => r.url)).size }, null, 2) + '\n');
console.log('Role guide rebuilt from the analysis ontology and resource catalog.');

