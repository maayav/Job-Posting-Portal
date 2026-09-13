import mongoose from 'mongoose';
import axios from 'axios';
import { env } from '../config/env.js';
import { AppError } from '../utils/errors.js';

const MAX_REPOS = 10;
const README_EXCERPT_CHARS = 800;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const MANIFEST_FILES = ['package.json', 'requirements.txt'];

const githubCacheSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, unique: true, lowercase: true },
    data: { type: mongoose.Schema.Types.Mixed, required: true },
    fetchedAt: { type: Date, required: true },
  },
  { timestamps: true }
);

const GitHubCache = mongoose.models.GitHubCache || mongoose.model('GitHubCache', githubCacheSchema);

export function normalizeUsername(input) {
  if (typeof input !== 'string' || !input.trim()) {
    throw new AppError('GitHub username is required', 400, 'github_username_required');
  }
  let raw = input.trim().toLowerCase();
  raw = raw.replace(/^https?:\/\//i, '').replace(/^www\./i, '').replace(/^github\.com\//i, '');
  raw = raw.split('/')[0].split('?')[0];
  raw = raw.replace(/^@/, '');
  if (!/^[a-z0-9](?:[a-z0-9-]{0,37}[a-z0-9])?$/.test(raw)) {
    throw new AppError('Invalid GitHub username', 400, 'invalid_github_username');
  }
  return raw;
}

const http = axios.create({
  baseURL: 'https://api.github.com',
  timeout: 15000,
  headers: {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    ...(env.GITHUB_TOKEN ? { Authorization: `Bearer ${env.GITHUB_TOKEN}` } : {}),
  },
});

async function ghGet(url, { raw = false, params = {} } = {}) {
  try {
    const res = await http.get(url, {
      params,
      headers: raw ? { Accept: 'application/vnd.github.raw+json' } : undefined,
      responseType: raw ? 'text' : 'json',
    });
    return res.data;
  } catch (err) {
    const status = err.response?.status;
    if (status === 404) {
      throw new AppError('GitHub profile not found', 404, 'github_not_found');
    }
    if (status === 403 || status === 429) {
      throw new AppError('GitHub rate limit exceeded', 503, 'github_unavailable');
    }
    if (err.code === 'ECONNABORTED') {
      throw new AppError('GitHub request timed out', 503, 'github_unavailable');
    }
    throw new AppError('GitHub service unavailable', 503, 'github_unavailable');
  }
}

function truncate(text, max) {
  if (!text) return '';
  return text.length <= max ? text : `${text.slice(0, max)}…`;
}

async function collectRepo(owner, repoName) {
  const repo = {};
  try {
    const readme = await ghGet(`/repos/${owner}/${repoName}/readme`, { raw: true });
    repo.readme = truncate(readme, README_EXCERPT_CHARS);
  } catch {
    repo.readme = '';
  }

  try {
    repo.languages = await ghGet(`/repos/${owner}/${repoName}/languages`);
  } catch {
    repo.languages = {};
  }

  repo.manifests = {};
  for (const file of MANIFEST_FILES) {
    try {
      const content = await ghGet(`/repos/${owner}/${repoName}/contents/${file}`);
      if (content && content.content) {
        repo.manifests[file] = Buffer.from(content.content, 'base64').toString('utf8').slice(0, 2000);
      }
    } catch {
      // manifest file absent — skip
    }
  }
  return repo;
}

export async function fetchGithubProfile(username) {
  const normalized = username.toLowerCase();

  const cached = await GitHubCache.findOne({ username: normalized });
  if (cached && Date.now() - new Date(cached.fetchedAt).getTime() < CACHE_TTL_MS) {
    return { username: normalized, ...cached.data, fromCache: true };
  }

  await ghGet(`/users/${normalized}`);

  const repoList = await ghGet(`/users/${normalized}/repos`, {
    params: { sort: 'pushed', per_page: MAX_REPOS },
  });

  const repos = [];
  for (const item of repoList.slice(0, MAX_REPOS)) {
    if (item.fork) continue;
    const extra = await collectRepo(item.owner.login, item.name);
    repos.push({
      name: item.name,
      fork: item.fork,
      pushedAt: item.pushed_at,
      language: item.language,
      topics: item.topics || [],
      ...extra,
    });
  }

  const payload = { repos, fetchedAt: new Date().toISOString(), fromCache: false };

  await GitHubCache.findOneAndUpdate(
    { username: normalized },
    { $set: { username: normalized, data: payload, fetchedAt: new Date() } },
    { upsert: true }
  );

  return { username: normalized, ...payload };
}