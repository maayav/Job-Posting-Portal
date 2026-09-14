import axios from 'axios';
import { env } from '../config/env.js';
import { AppError } from '../utils/errors.js';
import { withTransientRetry, isTransientError } from '../utils/retry.js';

const API_BASE = 'https://generativelanguage.googleapis.com/v1beta';

export function normalizeName(name) {
  return String(name).trim().toLowerCase();
}

export function l2Norm(vector) {
  const sum = vector.reduce((acc, x) => acc + x * x, 0);
  const norm = Math.sqrt(sum);
  return norm || 1;
}

export function normalizeVector(vector) {
  const norm = l2Norm(vector);
  return vector.map((x) => x / norm);
}

export function cosineSimilarity(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length || a.length === 0) return 0;
  let dot = 0;
  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i];
  }
  return Math.max(-1, Math.min(1, dot));
}

async function embedRequest(text) {
  const url = `${API_BASE}/models/${env.EMBEDDING_MODEL}:embedContent?key=${env.GEMINI_API_KEY}`;
  const res = await axios.post(
    url,
    {
      model: `models/${env.EMBEDDING_MODEL}`,
      content: { parts: [{ text }] },
    },
    { timeout: 30000 }
  );
  const values = res.data?.embedding?.values;
  if (!Array.isArray(values) || values.length === 0) {
    throw new Error('Embedding response missing values');
  }
  return normalizeVector(values);
}

async function embedBatchRequest(names) {
  const url = `${API_BASE}/models/${env.EMBEDDING_MODEL}:batchEmbedContents?key=${env.GEMINI_API_KEY}`;
  const res = await axios.post(
    url,
    {
      requests: names.map((text) => ({
        model: `models/${env.EMBEDDING_MODEL}`,
        content: { parts: [{ text }] },
      })),
    },
    { timeout: 60000 }
  );
  const embeddings = res.data?.embeddings;
  if (!Array.isArray(embeddings) || embeddings.length !== names.length) {
    throw new Error('Batch embedding response missing values');
  }
  return embeddings.map((entry) => {
    const values = entry?.values;
    if (!Array.isArray(values) || values.length === 0) {
      throw new Error('Batch embedding entry missing values');
    }
    return normalizeVector(values);
  });
}

export async function embedSkill(name) {
  const text = normalizeName(name);
  try {
    return await withTransientRetry(() => embedRequest(text), { label: 'Embedding' });
  } catch (err) {
    if (err instanceof AppError) throw err;
    if (isTransientError(err)) {
      throw new AppError('Embedding service unavailable', 503, 'service_unavailable');
    }
    throw new AppError('Embedding failed', 422, 'embedding_failed');
  }
}

// Embed many skill names in a single API request — critical for staying inside
// the free-tier quota (20 requests/min): one analysis needs ~16 embeddings, which
// used to be 16 calls and exhausted the quota in seconds.
export async function embedSkillsBatch(names) {
  const normalized = names.map((name) => normalizeName(name));
  if (normalized.length === 0) return [];
  try {
    return await withTransientRetry(
      () => embedBatchRequest(normalized),
      { label: 'Embedding batch', attempts: 3, delays: [2000, 5000, 10000] }
    );
  } catch (err) {
    if (err instanceof AppError) throw err;
    if (isTransientError(err)) {
      throw new AppError('Embedding service unavailable', 503, 'service_unavailable');
    }
    throw new AppError('Embedding failed', 422, 'embedding_failed');
  }
}