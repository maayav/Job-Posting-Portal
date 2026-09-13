import { cosineSimilarity, normalizeName } from './embeddingService.js';
import { ResourceCatalog } from '../models/resourceCatalog.js';

const STRONG_MIN = 80;
const DEVELOPING_MIN = 60;

export function computeBestMatches(ontologySkills, candidateVectors) {
  const perSkill = [];
  for (const skill of ontologySkills) {
    let best = 0;
    let matched = null;
    for (const candidate of candidateVectors) {
      const sim = cosineSimilarity(skill.embedding_vector, candidate.vector);
      if (sim > best) {
        best = sim;
        matched = candidate.name;
      }
    }
    const m = Math.max(0, Math.min(1, best));
    const percent = Math.round(m * 100);
    perSkill.push({ skill: skill.skill_name, weight: skill.weight, m, percent, matched });
  }
  return perSkill;
}

export function computeScore(perSkill) {
  let numerator = 0;
  let denominator = 0;
  for (const item of perSkill) {
    numerator += item.weight * item.m;
    denominator += item.weight;
  }
  if (denominator === 0) return 0;
  return Math.round((100 * numerator) / denominator);
}

export function categorize(perSkill) {
  const strong = [];
  const developing = [];
  const gaps = [];
  for (const item of perSkill) {
    const entry = { skill: item.skill, percent: item.percent };
    if (item.percent >= STRONG_MIN) strong.push(entry);
    else if (item.percent >= DEVELOPING_MIN) developing.push(entry);
    else gaps.push({ ...entry, weight: item.weight, m: item.m });
  }

  let maxRaw = 0;
  const priorities = gaps.map((g) => {
    const raw = g.weight * (1 - g.m);
    maxRaw = Math.max(maxRaw, raw);
    return raw;
  });
  gaps.forEach((g, idx) => {
    g.priority = maxRaw > 0 ? Number((priorities[idx] / maxRaw).toFixed(4)) : 0;
  });

  return { strong, developing, gaps };
}

export async function buildStudyPlan(gaps) {
  const plan = [];
  for (const g of gaps) {
    const resources = await ResourceCatalog.find({ skill_name: new RegExp(`^${escapeRegExp(g.skill)}$`, 'i') }).lean();
    const mapped = resources.map((r) => ({
      title: r.title,
      url: r.url,
      type: r.type,
      verified: r.verified,
    }));
    plan.push({
      skill: g.skill,
      priority: g.priority,
      resources: mapped,
      done: false,
    });
  }

  plan.sort((a, b) => b.priority - a.priority);
  return plan;
}

function escapeRegExp(text) {
  return String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export async function generateReport(ontologySkills, candidateVectors) {
  const perSkill = computeBestMatches(ontologySkills, candidateVectors);
  const score = computeScore(perSkill);
  const { strong, developing, gaps } = categorize(perSkill);
  const study_plan = await buildStudyPlan(gaps);
  return { score, strong_areas: strong, developing_areas: developing, gaps, study_plan };
}

export { normalizeName };