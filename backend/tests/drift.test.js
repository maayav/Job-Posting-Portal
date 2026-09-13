import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { computeRoleScore, loadBaseline, DRIFT_CANDIDATES } from '../scripts/drift-core.js';
import { connectDB, disconnectDB } from '../src/config/db.js';
import { SkillOntology } from '../src/models/skillOntology.js';
import { seedRealOntology } from '../scripts/drift-core.js';

// Opt-in regression test (Section 14): run after any embedding-library or
// embedding-model upgrade with: RUN_DRIFT_TEST=1 npx vitest run tests/drift.test.js
// Requires a real GEMINI_API_KEY and the drift baseline fixture.
describe.skipIf(process.env.RUN_DRIFT_TEST !== '1')('Embedding drift regression (Section 14)', () => {
  beforeAll(async () => {
    await seedRealOntology();
  });
  afterAll(async () => {
    await disconnectDB();
  });

  it('matches the recorded baseline scores within tolerance for every role', async () => {
    const baseline = loadBaseline();

    const entries = await SkillOntology.find({}).lean();
    const storedModels = new Set(entries.map((e) => e.embedding_model));
    const storedVersions = new Set(entries.map((e) => e.embedding_version));
    expect([...storedModels]).toEqual([baseline.embedding_model]);
    expect([...storedVersions]).toEqual([baseline.embedding_version]);

    for (const role of Object.keys(DRIFT_CANDIDATES)) {
      const recorded = baseline.roles[role]?.score;
      expect(recorded, `baseline missing for ${role}`).toBeTypeOf('number');
      const current = await computeRoleScore(role);
      expect(Math.abs(current - recorded), `score drift for ${role}`).toBeLessThanOrEqual(baseline.tolerance);
    }
  });

  it('records the pinned embedding model and version on every stored vector', async () => {
    const baseline = loadBaseline();
    const entries = await SkillOntology.find({}).lean();
    for (const entry of entries) {
      expect(entry.embedding_model).toBe(baseline.embedding_model);
      expect(entry.embedding_version).toBe(baseline.embedding_version);
      expect(entry.embedding_vector).toBeTypeOf('object');
      expect(entry.embedding_vector.length).toBeGreaterThan(0);
    }
  });
});