import { connectDB, disconnectDB } from '../src/config/db.js';
import { env } from '../src/config/env.js';
import { SkillOntology } from '../src/models/skillOntology.js';
import { ResourceCatalog } from '../src/models/resourceCatalog.js';
import { embedSkill } from '../src/services/embeddingService.js';
import { loadOntologyFiles, loadResourceEntries } from './ontology-loader.js';

async function seedOntology() {
  const entries = loadOntologyFiles();
  let embedded = 0;

  for (const entry of entries) {
    const vector = await embedSkill(entry.skill_name);
    await SkillOntology.findOneAndUpdate(
      { skill_name: entry.skill_name },
      {
        $set: {
          skill_name: entry.skill_name,
          category: entry.category,
          embedding_model: env.EMBEDDING_MODEL,
          embedding_version: env.EMBEDDING_VERSION,
          embedding_vector: vector,
          roles: entry.roles,
        },
      },
      { upsert: true }
    );
    embedded += 1;
  }
  console.log(`Ontology: ${embedded} skills embedded (model=${env.EMBEDDING_MODEL}, version=${env.EMBEDDING_VERSION})`);
}

async function seedResources() {
  const entries = loadResourceEntries();
  let inserted = 0;
  for (const resource of entries) {
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