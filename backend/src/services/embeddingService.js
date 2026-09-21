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
  if (!env.GEMINI_API_KEY) {
    throw new AppError('GEMINI_API_KEY is required for embeddings', 503, 'ai_configuration_error');
  }
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
  if (!env.GEMINI_API_KEY) {
    throw new AppError('GEMINI_API_KEY is required for embeddings', 503, 'ai_configuration_error');
  }
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

// Embed many skill names in as few API requests as possible — critical for
// staying inside the free-tier quota (20 requests/min). Requests are chunked
// because batchEmbedContents has a per-request limit.
const BATCH_CHUNK_SIZE = 50;

export async function embedSkillsBatch(names) {
  const normalized = names.map((name) => normalizeName(name));
  if (normalized.length === 0) return [];

  const results = [];
  try {
    for (let i = 0; i < normalized.length; i += BATCH_CHUNK_SIZE) {
      const chunk = normalized.slice(i, i + BATCH_CHUNK_SIZE);
      const vectors = await withTransientRetry(
        () => embedBatchRequest(chunk),
        { label: 'Embedding batch', attempts: 3, delays: [2000, 5000, 10000] }
      );
      results.push(...vectors);
    }
    return results;
  } catch (err) {
    if (err instanceof AppError) throw err;
    if (isTransientError(err)) {
      throw new AppError('Embedding service unavailable', 503, 'service_unavailable');
    }
    throw new AppError('Embedding failed', 422, 'embedding_failed');
  }
}