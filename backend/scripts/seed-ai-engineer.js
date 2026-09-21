import { readFileSync } from 'node:fs';
import { connectDB, disconnectDB } from '../src/config/db.js';
import { env } from '../src/config/env.js';
import { SkillOntology } from '../src/models/skillOntology.js';
import { ResourceCatalog } from '../src/models/resourceCatalog.js';
import { embedSkillsBatch } from '../src/services/embeddingService.js';
import { Job } from '../src/models/job.js';
import { User } from '../src/models/user.js';
import { AI_ENGINEER_JOB } from './ai-engineer-job.js';

const { skills } = JSON.parse(readFileSync(new URL('../ontology/ai-engineer.json', import.meta.url)));
const { resources } = JSON.parse(readFileSync(new URL('../resources/resources-ai-engineer.json', import.meta.url)));
try {
  await connectDB({ retry: false });
  const stored = await SkillOntology.find({ skill_name: { $in: skills.map((s) => s.skill_name) } }).lean();
  const current = new Map(stored.map((s) => [s.skill_name, s]));
  const missing = skills.filter((s) => {
    const old = current.get(s.skill_name);
    return !old?.embedding_vector?.length || old.embedding_model !== env.EMBEDDING_MODEL || old.embedding_version !== env.EMBEDDING_VERSION;
  });
  // Finish embedding before publishing this role; never insert invented vectors.
  const vectors = await embedSkillsBatch(missing.map((s) => s.skill_name));
  const embedded = new Map(missing.map((s, i) => [s.skill_name, vectors[i]]));
  for (const skill of skills) {
    const old = current.get(skill.skill_name);
    const roles = [...(old?.roles ?? []).filter((r) => r.role_name !== 'AI Engineer'), ...skill.roles];
    await SkillOntology.updateOne({ skill_name: skill.skill_name }, { $set: {
      category: old?.category ?? skill.category, roles,
      embedding_model: env.EMBEDDING_MODEL, embedding_version: env.EMBEDDING_VERSION,
      embedding_vector: embedded.get(skill.skill_name) ?? old.embedding_vector,
    } }, { upsert: true });
  }
  for (const resource of resources) {
    await ResourceCatalog.updateOne({ skill_name: resource.skill_name, url: resource.url }, { $set: resource }, { upsert: true });
  }
  console.log('AI Engineer ready: 16 skills and curated resources. Other roles preserved.');
  if (process.argv.includes('--with-demo-job')) {
    const admin = await User.findOne({ role: 'admin' }).sort({ createdAt: 1 }).select('_id');
    if (!admin) throw new Error('Create an admin before adding the demo job.');
    const existing = await Job.exists({ title: AI_ENGINEER_JOB.title, company: AI_ENGINEER_JOB.company });
    if (!existing) await Job.create({ ...AI_ENGINEER_JOB, createdBy: admin._id });
    console.log('AI Engineer demo job available; existing job edits preserved.');
  }
} catch (error) {
  console.error('AI Engineer setup failed:', error.code ?? error.name);
  process.exitCode = 1;
} finally {
  await disconnectDB();
}
