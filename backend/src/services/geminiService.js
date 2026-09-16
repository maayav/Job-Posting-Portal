import axios from 'axios';
import { z } from 'zod';
import { env } from '../config/env.js';
import { AppError } from '../utils/errors.js';

const API_BASE = 'https://generativelanguage.googleapis.com/v1beta';

export const SKILL_CATEGORIES = [
  'language',
  'frontend_framework',
  'backend_framework',
  'database',
  'ml_framework',
  'devops_tool',
  'cloud_platform',
  'testing_tool',
  'other',
];

const proficiencySchema = z.object({
  projects_count: z.coerce
    .number()
    .catch(0)
    .transform((value) => Math.max(0, Math.min(5, Math.round(value)))),
  has_production_usage: z.boolean().catch(false),
  mentions_depth: z.enum(['low', 'medium', 'high']).catch('low'),
});

export const skillSchema = z.object({
  skills: z.array(
    z.object({
      name: z.string().trim().min(1),
      category: z.enum(SKILL_CATEGORIES).catch('other'),
      sources: z.array(z.enum(['resume', 'github'])).default([]),
      evidence: z
        .array(z.object({ source: z.enum(['resume', 'github']), text: z.string().trim() }))
        .default([]),
      proficiency_signals: proficiencySchema.default({
        projects_count: 0,
        has_production_usage: false,
        mentions_depth: 'low',
      }),
    })
  ),
});

const RETRY_DELAYS_MS = [1000, 2000, 4000];
const MAX_TRANSIENT_ATTEMPTS = 3;

function modelChain() {
  const fallbacks = (env.GEMINI_FALLBACK_MODELS || '')
    .split(',')
    .map((m) => m.trim())
    .filter(Boolean);
  return [...new Set([env.GEMINI_MODEL, ...fallbacks])];
}

function isTransientError(err) {
  const status = err.response?.status;
  if ([429, 500, 502, 503, 504].includes(status)) return true;
  if (err.code === 'ECONNABORTED' || err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND') return true;
  if (!err.response && err.message) return true;
  return false;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Parse "Please retry in N.Ns." from the 429 body so we wait out the quota
// window instead of hammering with fixed 1s/2s/4s delays.
function retryAfterSecondsFromError(err) {
  const raw = err.response?.data?.error?.message ?? '';
  const match = raw.match(/retry in ([\d.]+)s/i);
  if (match) {
    return Math.min(60, Math.max(1, Math.ceil(Number(match[1]))));
  }
  const header = Number(err.response?.headers?.['retry-after']);
  if (Number.isFinite(header) && header > 0) {
    return Math.min(60, Math.ceil(header));
  }
  return null;
}

async function generateContent(prompt, model) {
  const url = `${API_BASE}/models/${model}:generateContent?key=${env.GEMINI_API_KEY}`;
  const res = await axios.post(
    url,
    {
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.2, responseMimeType: 'application/json' },
    },
    { timeout: 60000 }
  );
  const text = res.data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (typeof text !== 'string' || !text.trim()) {
    const err = new Error('Gemini returned no content');
    err.code = 'empty_content';
    throw err;
  }
  return text;
}

async function generateContentWithTransientRetry(prompt, model) {
  let lastError;
  for (let attempt = 1; attempt <= MAX_TRANSIENT_ATTEMPTS; attempt += 1) {
    try {
      return await generateContent(prompt, model);
    } catch (err) {
      lastError = err;
      if (attempt < MAX_TRANSIENT_ATTEMPTS && isTransientError(err)) {
        // Log the raw upstream status + API error body so quota/overload causes
        // are visible in server.log, not just the mapped errorCode.
        const raw = err.response?.data?.error;
        console.error(
          `Gemini transient failure [${model}] (attempt ${attempt}): HTTP ${err.response?.status ?? 'no response'} ` +
          `${raw ? `${raw.status ?? ''} ${raw.message ?? ''}`.trim() : err.message}`
        );
        const waitSeconds = retryAfterSecondsFromError(err);
        await sleep((waitSeconds ?? RETRY_DELAYS_MS[attempt - 1] / 1000) * 1000);
        continue;
      }
      throw err;
    }
  }
  throw lastError;
}

function stripCodeFences(text) {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  return cleaned;
}

async function callExtraction(prompt, model) {
  const raw = await generateContentWithTransientRetry(prompt, model);
  const parsed = skillSchema.safeParse(JSON.parse(stripCodeFences(raw)));
  if (!parsed.success) {
    const err = new Error('Gemini output failed schema validation');
    err.code = 'schema_invalid';
    throw err;
  }
  return parsed.data.skills;
}

const PROMPT_TEMPLATE = `You are a technical skill extraction engine. Analyze the candidate PROFILE DATA below and extract every technical skill that is genuinely supported by the data.

Return ONLY a single valid JSON object (no markdown fences, no commentary, no extra text) with exactly this shape:
{
  "skills": [
    {
      "name": "React",
      "category": "frontend_framework",
      "sources": ["resume", "github"],
      "evidence": [{ "source": "resume", "text": "Built a React-based placement dashboard" }],
      "proficiency_signals": { "projects_count": 2, "has_production_usage": true, "mentions_depth": "high" }
    }
  ]
}

Field rules:
- "name": one specific technical skill, technology, framework, tool, or engineering capability (e.g. "React", "MongoDB", "PyTorch", "REST APIs", "Feature Engineering"). Technical skills only — never soft skills such as "Communication", "Teamwork", "Leadership", or "Problem Solving".
- "category": exactly one of ["language", "frontend_framework", "backend_framework", "database", "ml_framework", "devops_tool", "cloud_platform", "testing_tool", "other"].
- "sources": array containing "resume" and/or "github" — list only the sources where the skill actually appears.
- "evidence": up to 2 short excerpts (max ~120 characters each), one per source, copied verbatim or near-verbatim from the PROFILE DATA. Use an empty array only when the skill appears as a bare keyword with no supporting sentence.
- "proficiency_signals":
  - "projects_count": integer 0-5 — the number of distinct projects, roles, or experiences in the data that use this skill.
  - "has_production_usage": true only when the data shows real professional or deployed use (e.g. production, deployed, live users, internship, employment); otherwise false.
  - "mentions_depth": "low" | "medium" | "high" — how deeply the data discusses the skill (bare keyword = low; listed with a project sentence = medium; detailed impact, scale, or architecture = high).

Strictness rules:
- Extract ONLY skills justified by the PROFILE DATA. Never invent, infer, or pad skills that are not present.
- If a technology is absent from the data, it must be absent from the output. Do not add a skill just because it is common in the field, and do not add a skill because it is missing (gaps are computed later by the scoring pipeline, not here).
- Include every meaningful technical skill the data supports: aim for 8-40 skills when the profile is rich, and only fewer when the data is genuinely sparse. Never reach the count by inventing skills.
- If the profile contains no technical skills at all, return exactly {"skills": []}.
- Evidence must be copied from the PROFILE DATA — never paraphrase, translate, or fabricate an excerpt. If you cannot find a supporting excerpt, use an empty evidence array.
- Skills that appear only as bare keywords in a list are still valid skills: include them with an empty "evidence" array and "mentions_depth": "low".
- Do not emit duplicates; merge casing variants into one entry and use the most specific common name (e.g. "PyTorch" rather than "Deep Learning Frameworks", "React" rather than "React.js").
- "category" must be exactly one of the allowed values — use "other" when none fit.
- Return the JSON object only, with no markdown fences and no text before or after it.

PROFILE DATA:
`;

// Try the primary model first, then each fallback model (separate quota buckets
// and capacity). Transient overload/quota failures move to the next model;
// malformed JSON retries once on the same model, then fails as extraction_invalid.
export async function extractSkills(profileText) {
  const prompt = PROMPT_TEMPLATE + profileText;
  let lastError;

  for (const model of modelChain()) {
    try {
      const skills = await callExtraction(prompt, model);
      return { skills, model };
    } catch (err) {
      if (err.code === 'schema_invalid') {
        try {
          const skills = await callExtraction(prompt, model);
          return { skills, model };
        } catch (retryErr) {
          if (retryErr.code === 'schema_invalid') {
            throw new AppError('Skill extraction returned invalid data', 422, 'extraction_invalid');
          }
          lastError = retryErr;
          console.error(`Gemini model ${model} failed after malformed-JSON retry, trying fallback`);
          continue;
        }
      }

      lastError = err;
      if (isTransientError(err)) {
        console.error(`Gemini model ${model} unavailable, trying fallback model`);
        continue;
      }
      throw mapGeminiError(err);
    }
  }

  throw mapGeminiError(lastError);
}

function mapGeminiError(err) {
  if (err instanceof AppError) return err;
  const status = err.response?.status;
  if (status === 429) {
    return new AppError('AI service is rate limited', 503, 'service_unavailable');
  }
  if (status === 400 && err.response?.data?.error?.message?.includes('API key')) {
    return new AppError('AI service authentication failed', 503, 'service_unavailable');
  }
  if (isTransientError(err)) {
    return new AppError('AI service unavailable', 503, 'service_unavailable');
  }
  return new AppError('Skill extraction failed', 422, 'extraction_invalid');
}