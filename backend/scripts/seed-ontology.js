import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { connectDB, disconnectDB } from '../src/config/db.js';
import { env } from '../src/config/env.js';
import { SkillOntology } from '../src/models/skillOntology.js';
import { ResourceCatalog } from '../src/models/resourceCatalog.js';
import { embedSkill } from '../src/services/embeddingService.js';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

function loadJson(rel) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8'));
}

async function seedOntology() {
  const files = ['sde.json', 'ml-engineer.json'];
  let embedded = 0;

  for (const file of files) {
    const data = loadJson(path.join('ontology', file));
    console.log(`Seeding ontology for role "${data.role}" (${data.skills.length} skills)`);

    for (const skill of data.skills) {
      const vector = await embedSkill(skill.skill_name);
      await SkillOntology.findOneAndUpdate(
        { skill_name: skill.skill_name },
        {
          $set: {
            skill_name: skill.skill_name,
            category: skill.category,
            embedding_model: env.EMBEDDING_MODEL,
            embedding_version: env.EMBEDDING_VERSION,
            embedding_vector: vector,
            roles: skill.roles,
          },
        },
        { upsert: true }
      );
      embedded += 1;
    }
  }
  console.log(`Ontology: ${embedded} skills embedded (model=${env.EMBEDDING_MODEL}, version=${env.EMBEDDING_VERSION})`);
}

async function seedResources() {
  const data = loadJson(path.join('resources', 'resources.json'));
  let inserted = 0;
  for (const resource of data.resources) {
    await ResourceCatalog.findOneAndUpdate(
      { skill_name: resource.skill_name, url: resource.url },
      { $set: resource },
      { upsert: true }
    );
    inserted += 1;
  }
  console.log(`Resources: ${inserted} catalog entries upserted`);
}

async function main() {
  await connectDB({ retry: true });
  await seedOntology();
  await seedResources();
  await disconnectDB();
  console.log('Seed complete.');
}

main().catch(async (err) => {
  console.error('Seed failed:', err.message);
  await disconnectDB();
  process.exit(1);
});