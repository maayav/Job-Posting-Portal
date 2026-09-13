import { connectDB, disconnectDB } from '../src/config/db.js';
import { env } from '../src/config/env.js';
import { SkillOntology } from '../src/models/skillOntology.js';
import { embedSkill } from '../src/services/embeddingService.js';
import { loadOntologyFiles } from './ontology-loader.js';

// Admin script (Section 14): update a role's skill weights in ontology/*.json,
// then run `npm run refresh-ontology` to re-embed and upsert affected skills.
// Embedding model/version are pinned — changing them requires recording a new
// drift baseline (npm run drift-baseline) and re-running the drift test.

async function main() {
  await connectDB({ retry: true });

  const entries = loadOntologyFiles();
  let updated = 0;
  let embedded = 0;

  for (const entry of entries) {
    const existing = await SkillOntology.findOne({ skill_name: entry.skill_name });
    const weightsChanged = existing?.roles.some((r, i) => r.weight !== entry.roles[i]?.weight || r.role_name !== entry.roles[i]?.role_name);

    let vector = existing?.embedding_vector;
    const embeddingChanged =
      !existing ||
      existing.embedding_model !== env.EMBEDDING_MODEL ||
      existing.embedding_version !== env.EMBEDDING_VERSION;

    if (!vector || embeddingChanged) {
      vector = await embedSkill(entry.skill_name);
      embedded += 1;
    }

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
    updated += 1;
    if (weightsChanged) console.log(`  weights updated: ${entry.skill_name}`);
  }

  console.log(`Refresh complete: ${updated} skills checked, ${embedded} re-embedded (${env.EMBEDDING_MODEL} ${env.EMBEDDING_VERSION}).`);
  console.log('If the embedding model/version changed, run `npm run drift-baseline` and the drift test.');
  await disconnectDB();
}

main().catch(async (err) => {
  console.error('Refresh failed:', err.message);
  await disconnectDB();
  process.exit(1);
});