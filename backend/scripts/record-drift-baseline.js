import { computeRoleScore, saveBaseline, DRIFT_CANDIDATES } from './drift-core.js';
import { disconnectDB } from '../src/config/db.js';

async function main() {
  const { seedRealOntology } = await import('./drift-core.js');
  const { model, version } = await seedRealOntology();

  const baseline = {
    embedding_model: model,
    embedding_version: version,
    recorded_at: new Date().toISOString(),
    tolerance: 2,
    roles: {},
  };

  for (const role of Object.keys(DRIFT_CANDIDATES)) {
    baseline.roles[role] = { score: await computeRoleScore(role) };
    console.log(`role ${role}: score ${baseline.roles[role].score}`);
  }

  saveBaseline(baseline);
  console.log(`Baseline recorded to tests/fixtures/drift-baseline.json (${model} ${version})`);
  await disconnectDB();
}

main().catch(async (err) => {
  console.error('Failed:', err.message);
  await disconnectDB();
  process.exit(1);
});