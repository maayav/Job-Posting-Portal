import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Converts reviewed role drafts (ontology/drafts/new-roles-draft.json) into
// live ontology seed files (one per role) that scripts/seed-ontology.js loads.
// Weights are normalized from the draft's 1-5 scale to the live 0-1 schema.

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const DRAFT_FILE = path.join(ROOT, 'ontology', 'drafts', 'new-roles-draft.json');
const OUT_DIR = path.join(ROOT, 'ontology');

// Draft skill names -> canonical ontology names, so shared skills merge into a
// single SkillOntology entry instead of creating near-duplicates.
const ALIASES = {
  'RESTful APIs': 'REST APIs',
  'Scikit-Learn': 'scikit-learn',
  Spark: 'Apache Spark',
  'IAM (Identity and Access Management)': 'IAM',
};

function slugify(role) {
  return role
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function canonicalSkill(name) {
  return ALIASES[name] ?? name;
}

function normalizeWeight(weight) {
  return Math.round((weight / 5) * 100) / 100;
}

function main() {
  const draft = JSON.parse(fs.readFileSync(DRAFT_FILE, 'utf8'));
  const written = [];

  for (const [role, data] of Object.entries(draft.roles)) {
    const skills = data.skills.map((skill) => ({
      skill_name: canonicalSkill(skill.name),
      category: skill.category,
      roles: [{ role_name: role, weight: normalizeWeight(skill.weight) }],
    }));

    const file = path.join(OUT_DIR, `${slugify(role)}.json`);
    fs.writeFileSync(file, `${JSON.stringify({ role, skills }, null, 2)}\n`);
    written.push(`${path.relative(ROOT, file)} (${skills.length} skills)`);
  }

  console.log(`Imported ${written.length} roles:`);
  for (const line of written) console.log(`  - ${line}`);
  console.log('Run `npm run seed` to embed and load them.');
}

main();