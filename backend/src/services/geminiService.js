import axios from 'axios';
import { z } from 'zod';
import { env } from '../config/env.js';
import { AppError } from '../utils/errors.js';

const API_BASE = 'https://generativelanguage.googleapis.com/v1beta';

export const skillSchema = z.object({
  skills: z.array(
    z.object({
      name: z.string().trim().min(1),
      sources: z.array(z.enum(['resume', 'github'])).default([]),
      evidence: z
        .array(z.object({ source: z.enum(['resume', 'github']), text: z.string().trim() }))
        .default([]),
    })
  ),
});

const RETRY_DELAYS_MS = [1000, 2000, 4000];
const MAX_TRANSIENT_ATTEMPTS = 3;

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

async function generateContent(prompt) {
  const url = `${API_BASE}/models/${env.GEMINI_MODEL}:generateContent?key=${env.GEMINI_API_KEY}`;
  const res = await axios.post(
    url,
    {
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.2, responseMimeType: 'application/json' },
    },
    { timeout: 30000 }
  );
  const text = res.data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (typeof text !== 'string' || !text.trim()) {
    const err = new Error('Gemini returned no content');
    err.code = 'empty_content';
    throw err;
  }
  return text;
}

async function generateContentWithTransientRetry(prompt) {
  let lastError;
  for (let attempt = 1; attempt <= MAX_TRANSIENT_ATTEMPTS; attempt += 1) {
    try {
      return await generateContent(prompt);
    } catch (err) {
      lastError = err;
      if (attempt < MAX_TRANSIENT_ATTEMPTS && isTransientError(err)) {
        // Log the raw upstream status + API error body so quota/overload causes
        // are visible in server.log, not just the mapped errorCode.
        const raw = err.response?.data?.error;
        console.error(
          `Gemini transient failure (attempt ${attempt}): HTTP ${err.response?.status ?? 'no response'} ` +
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

async function callExtraction(prompt) {
  const raw = await generateContentWithTransientRetry(prompt);
  const parsed = skillSchema.safeParse(JSON.parse(stripCodeFences(raw)));
  if (!parsed.success) {
    const err = new Error('Gemini output failed schema validation');
    err.code = 'schema_invalid';
    throw err;
  }
  return parsed.data.skills;
}

export async function extractSkills(profileText) {
  const prompt = `Extract demonstrated skills from this profile data with supporting evidence. Return ONLY valid JSON, no markdown fences, matching exactly this shape:
{
  "skills": [
    { "name": "React", "sources": ["resume", "github"],
      "evidence": [{ "source": "resume", "text": "Built a React-based placement dashboard" }] }
  ]
}

Rules:
- "name" is a specific technology or capability (e.g. "React", "MongoDB", "PyTorch", "REST APIs"). Do not invent skills that are not supported by the data.
- "sources" lists which parts of the profile data mention the skill ("resume" and/or "github").
- "evidence" must be short excerpts (max ~120 chars) taken verbatim or near-verbatim from the profile data, one per source, supporting the skill.
- If a skill appears only as a bare listed keyword with no supporting sentence in any source, include it with an empty "evidence" array.
- Include 5 to 30 skills. Only return the JSON object.

PROFILE DATA:
${profileText}`;

  try {
    return await callExtraction(prompt);
  } catch (err) {
    if (err.code === 'schema_invalid') {
      // Malformed JSON shape: retry once with the same input, then fail cleanly.
      try {
        return await callExtraction(prompt);
      } catch (retryErr) {
        if (retryErr.code === 'schema_invalid') {
          throw new AppError('Skill extraction returned invalid data', 422, 'extraction_invalid');
        }
        throw mapGeminiError(retryErr);
      }
    }
    throw mapGeminiError(err);
  }
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