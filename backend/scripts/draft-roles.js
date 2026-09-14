import 'dotenv/config';
import axios from 'axios';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { env } from '../src/config/env.js';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const OUT_FILE = path.join(ROOT, 'ontology', 'drafts', 'new-roles-draft.json');

const ROLES = [
  'Full-Stack Developer',
  'Backend Developer',
  'Data Scientist',
  'Data Engineer',
  'DevOps Engineer',
  'Cybersecurity Analyst',
  'QA/Test Engineer',
  'Cloud Engineer',
];

const VALID_CATEGORIES = [
  'language', 'framework', 'database', 'cloud', 'devops',
  'core-cs', 'ml', 'data', 'tools', 'architecture', 'security', 'testing',
];

function modelChain() {
  // Lighter/less-loaded models first — drafting does not need the strongest model.
  const chain = ['gemini-flash-lite-latest', 'gemini-3-flash-preview', env.GEMINI_MODEL];
  return [...new Set(chain.filter(Boolean))];
}

async function generate(prompt, model) {
  const res = await axios.post(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${env.GEMINI_API_KEY}`,
    {
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.4, responseMimeType: 'application/json' },
    },
    { timeout: 30000 }
  );
  return res.data?.candidates?.[0]?.content?.parts?.[0]?.text;
}

async function generateWithFallback(prompt) {
  let lastError;
  for (const model of modelChain()) {
    try {
      const text = await generate(prompt, model);
      const parsed = JSON.parse(text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, ''));
      if (!Array.isArray(parsed.skills) || parsed.skills.length === 0) {
        throw new Error('missing skills array');
      }
      return { skills: parsed.skills, model };
    } catch (err) {
      lastError = err;
      const status = err.response?.status;
      console.error(`  [${model}] failed: HTTP ${status ?? 'n/a'} ${err.response?.data?.error?.message?.slice(0, 80) ?? err.message}`);
      if (status === 429) {
        const m = err.response?.data?.error?.message?.match(/retry in ([\d.]+)s/i);
        const wait = Math.min(20, Math.ceil(Number(m?.[1] ?? 3)));
        console.error(`  waiting ${wait}s for quota...`);
        await new Promise((r) => setTimeout(r, wait * 1000));
      }
    }
  }
  throw lastError;
}

function rolePrompt(role) {
  return `You are a technical hiring analyst. List the 12-15 most important skills required for a "${role}" role based on typical industry requirements and current job postings.

Return ONLY valid JSON (no markdown fences) in exactly this shape:
{
  "skills": [
    { "name": "JavaScript", "category": "language", "weight": 5, "note": "core language for the role" }
  ]
}

Rules:
- "weight" is an integer 1-5: 5 = absolutely critical, 1 = nice to have. Use the full range, don't give everything a 5.
- "category" must be one of: ${VALID_CATEGORIES.join(', ')}.
- "name" should be a specific technology or capability (e.g. "React", "PostgreSQL", "Terraform", "Threat Modeling"). Avoid vague entries like "Problem Solving" unless truly central.
- Keep skills non-overlapping; prefer concrete tools/technologies plus at most 3 conceptual skills.
- "note" is a short (max 12 words) reason for the weight.
- Order by weight descending.`;
}

function loadExisting() {
  try {
    return JSON.parse(fs.readFileSync(OUT_FILE, 'utf8'));
  } catch {
    return null;
  }
}

function saveDraft(draft) {
  fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
  fs.writeFileSync(OUT_FILE, JSON.stringify(draft, null, 2));
}

async function main() {
  const args = process.argv.slice(2);
  const force = args.includes('--force');
  const onlyArg = args.find((a) => a.startsWith('--only='));
  const only = onlyArg ? onlyArg.slice('--only='.length).split(',').map((s) => s.trim()) : ROLES;
  const unknown = only.filter((r) => !ROLES.includes(r));
  if (unknown.length) {
    console.error(`Unknown roles: ${unknown.join(', ')}\nAvailable: ${ROLES.join(', ')}`);
    process.exit(1);
  }

  const existing = loadExisting();
  const draft = existing ?? {
    generated_at: new Date().toISOString(),
    scale: '1-5 (5 = critical)',
    note: 'DRAFT for review — not loaded into SkillOntology. On approval, weights are normalized to 0-1 for the live schema.',
    roles: {},
  };

  let done = 0;
  for (const role of only) {
    if (!force && draft.roles[role]?.skills?.length) {
      console.log(`[skip] ${role} (already drafted, use --force to redo)`);
      done += 1;
      continue;
    }
    console.log(`[draft] ${role}...`);
    const started = Date.now();
    try {
      const { skills, model } = await generateWithFallback(rolePrompt(role));
      draft.roles[role] = {
        model_used: model,
        skills: skills.map((s) => ({
          name: s.name,
          category: VALID_CATEGORIES.includes(s.category) ? s.category : 'general',
          weight: Math.max(1, Math.min(5, Math.round(Number(s.weight) || 3))),
          note: s.note ?? '',
        })),
      };
      saveDraft(draft);
      console.log(`[done] ${role}: ${draft.roles[role].skills.length} skills via ${model} (${Math.round((Date.now() - started) / 1000)}s)`);
      done += 1;
    } catch (err) {
      console.error(`[fail] ${role}: ${err.message}`);
    }
  }

  console.log(`\n${done}/${only.length} roles drafted. Saved to ${path.relative(ROOT, OUT_FILE)}`);
}

main().catch((err) => {
  console.error('Draft failed:', err.message);
  process.exit(1);
});