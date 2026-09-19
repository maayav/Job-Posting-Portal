import { ResourceCatalog } from '../models/resourceCatalog.js';
import { normalizeSkillName, SYNONYMS } from '../utils/skillNormalizer.js';

const keyOf = (name) => normalizeSkillName(name).toLowerCase();
const escape = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function safeResource(resource) {
  try {
    const url = new URL(resource.url);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || resource.verified === false) return null;
    return { title: resource.title, url: resource.url, type: resource.type, verified: resource.verified === true };
  } catch { return null; }
}

// Resolve aliases within the same technology only. Never substitute a popular
// technology's links for an unknown skill, or trust URLs invented by the AI.
export async function resourcesForSkills(skills) {
  const keys = new Set(skills.map(keyOf));
  if (!keys.size) return new Map();
  const names = new Set([...skills.map((name) => name.trim()), ...keys]);
  Object.entries(SYNONYMS).forEach(([alias, canonical]) => {
    if (keys.has(keyOf(canonical))) names.add(alias);
  });
  const resources = await ResourceCatalog.find({
    skill_name: { $in: [...names].map((name) => new RegExp(`^${escape(name)}$`, 'i')) },
    verified: { $ne: false },
  }).sort({ type: 1, title: 1 }).lean();
  const grouped = new Map();
  for (const resource of resources) {
    const safe = safeResource(resource);
    if (!safe) continue;
    const key = keyOf(resource.skill_name);
    const list = grouped.get(key) ?? [];
    if (!list.some((entry) => entry.url === safe.url)) list.push(safe);
    grouped.set(key, list);
  }
  return grouped;
}

// Refresh links when a saved report is opened, without resetting completion,
// generated explanations, or study-plan item IDs.
export async function hydrateStudyPlan(items = []) {
  const resources = await resourcesForSkills(items.map((item) => item.skill));
  return items.map((item) => ({
    ...(typeof item.toObject === 'function' ? item.toObject() : item),
    resources: resources.get(keyOf(item.skill)) ?? [],
  }));
}
