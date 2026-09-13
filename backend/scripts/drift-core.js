import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
export const BASELINE_FILE = path.join(ROOT, 'tests', 'fixtures', 'drift-baseline.json');

export const DRIFT_CANDIDATES = {
  SDE: ['React', 'JavaScript', 'Node.js', 'Express', 'MongoDB', 'AWS', 'Git', 'Python', 'SQL', 'Docker'],
  'ML Engineer': ['Python', 'PyTorch', 'TensorFlow', 'scikit-learn', 'Pandas', 'NumPy', 'FastAPI', 'Git', 'SQL', 'NLP'],
};

export async function seedRealOntology() {
  const { connectDB } = await import('../src/config/db.js');
  const { SkillOntology } = await import('../src/models/skillOntology.js');
  const { ResourceCatalog } = await import('../src/models/resourceCatalog.js');
  const { embedSkill } = await import('../src/services/embeddingService.js');
  const { env } = await import('../src/config/env.js');

  await connectDB({ retry: true });
  await SkillOntology.deleteMany({});
  await ResourceCatalog.deleteMany({});

  const { loadOntologyFiles, loadResourceEntries } = await import('./ontology-loader.js');
  const entries = loadOntologyFiles();
  for (const entry of entries) {
    const vector = await embedSkill(entry.skill_name);
    await SkillOntology.create({
      skill_name: entry.skill_name,
      category: entry.category,
      embedding_model: env.EMBEDDING_MODEL,
      embedding_version: env.EMBEDDING_VERSION,
      embedding_vector: vector,
      roles: entry.roles,
    });
  }
  for (const resource of loadResourceEntries()) {
    await ResourceCatalog.create(resource);
  }
  return { model: env.EMBEDDING_MODEL, version: env.EMBEDDING_VERSION };
}

export async function computeRoleScore(role) {
  const { SkillOntology } = await import('../src/models/skillOntology.js');
  const { embedSkill } = await import('../src/services/embeddingService.js');
  const { computeBestMatches, computeScore } = await import('../src/services/scoringService.js');

  const raw = await SkillOntology.find({ roles: { $elemMatch: { role_name: role } } }).lean();
  if (raw.length === 0) throw new Error(`ontology empty for ${role}`);
  const ontology = raw.map((s) => ({
    ...s,
    weight: (s.roles || []).find((r) => r.role_name === role)?.weight ?? 0,
  }));

  const candidates = [];
  for (const name of DRIFT_CANDIDATES[role]) {
    candidates.push({ name, vector: await embedSkill(name) });
  }
  const perSkill = computeBestMatches(ontology, candidates);
  return computeScore(perSkill);
}

export function loadBaseline() {
  return JSON.parse(fs.readFileSync(BASELINE_FILE, 'utf8'));
}

export function saveBaseline(baseline) {
  fs.mkdirSync(path.dirname(BASELINE_FILE), { recursive: true });
  fs.writeFileSync(BASELINE_FILE, JSON.stringify(baseline, null, 2));
}