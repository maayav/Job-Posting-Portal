import mongoose from 'mongoose';
import axios from 'axios';
import { env } from '../config/env.js';
import { AppError } from '../utils/errors.js';
import { assertRequestBudget, requestSignal, requestTimeout } from '../utils/requestBudget.js';

const MAX_REPOS = 10;
const README_EXCERPT_CHARS = 800;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const FETCH_DEADLINE_MS = 25 * 1000;
const MANIFEST_FILES = ['package.json', 'requirements.txt'];

const githubCacheSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, unique: true, lowercase: true },
    data: { type: mongoose.Schema.Types.Mixed, required: true },
    fetchedAt: { type: Date, required: true },
  },
  { timestamps: true }
);

githubCacheSchema.index({ fetchedAt: 1 }, { expireAfterSeconds: 7 * 24 * 60 * 60 });
const GitHubCache = mongoose.models.GitHubCache || mongoose.model('GitHubCache', githubCacheSchema);

export function normalizeUsername(input) {
  if (typeof input !== 'string' || !input.trim()) {
    throw new AppError('GitHub username is required', 400, 'github_username_required');
  }
  let raw = input.trim();
  if (/^(?:https?:\/\/|(?:www\.)?github\.com\/)/i.test(raw)) {
    let url;
    try {
      url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    } catch {
      throw new AppError('Invalid GitHub profile URL', 400, 'invalid_github_username');
    }
    if (!['github.com', 'www.github.com'].includes(url.hostname.toLowerCase()) || url.username || url.password || url.port || !/^\/[^/]+\/?$/.test(url.pathname)) {
      throw new AppError('Enter a GitHub username or public profile URL', 400, 'invalid_github_username');
    }
    raw = url.pathname.split('/')[1];
  }
  raw = raw.replace(/^@/, '').toLowerCase();
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

async function ghGet(url, { raw = false, params = {}, client = http, deadline } = {}) {
  try {
    assertRequestBudget();
    if (deadline && Date.now() >= deadline) {
      throw new AppError('GitHub enrichment deadline exceeded', 503, 'github_unavailable');
    }
    const res = await client.get(url, {
      params,
      headers: raw ? { Accept: 'application/vnd.github.raw+json' } : undefined,
      responseType: raw ? 'text' : 'json',
      timeout: requestTimeout(deadline ? Math.max(1, Math.min(15000, deadline - Date.now())) : 15000),
      signal: requestSignal(),
      maxContentLength: 1024 * 1024,
    });
    assertRequestBudget();
    return res.data;
  } catch (err) {
    assertRequestBudget();
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
  if (typeof text !== 'string') return '';
  return text.length <= max ? text : `${text.slice(0, max)}…`;
}

async function collectRepo(owner, repoName, client, deadline) {
  const repo = {};
  try {
    const readme = await ghGet(`/repos/${owner}/${repoName}/readme`, { raw: true, client, deadline });
    repo.readme = truncate(readme, README_EXCERPT_CHARS);
  } catch {
    assertRequestBudget();
    repo.readme = '';
  }

  try {
    const languages = await ghGet(`/repos/${owner}/${repoName}/languages`, { client, deadline });
    repo.languages = languages && typeof languages === 'object' && !Array.isArray(languages)
      ? Object.fromEntries(Object.entries(languages).filter(([name, bytes]) => typeof name === 'string' && name.length <= 50 && Number.isFinite(bytes) && bytes > 0).slice(0, 30))
      : {};
  } catch {
    assertRequestBudget();
    repo.languages = {};
  }

  repo.manifests = {};
  for (const file of MANIFEST_FILES) {
    try {
      const content = await ghGet(`/repos/${owner}/${repoName}/contents/${file}`, { client, deadline });
      if (typeof content?.content === 'string' && (!content.encoding || content.encoding === 'base64')) {
        repo.manifests[file] = Buffer.from(content.content, 'base64').toString('utf8').slice(0, 2000);
      }
    } catch {
      assertRequestBudget();
      // manifest file absent — skip
    }
  }
  return repo;
}

function boundedCachedRepo(repo) {
  if (!repo || repo.private || repo.fork || typeof repo.name !== 'string' || !/^[A-Za-z0-9_.-]{1,100}$/.test(repo.name)) return null;
  const languages = repo.languages && typeof repo.languages === 'object' && !Array.isArray(repo.languages)
    ? Object.fromEntries(Object.entries(repo.languages).filter(([name, bytes]) => name.length <= 50 && Number.isFinite(bytes) && bytes > 0).slice(0, 30)) : {};
  return {
    name: repo.name, fork: false,
    pushedAt: typeof repo.pushedAt === 'string' ? repo.pushedAt : null,
    language: typeof repo.language === 'string' ? repo.language.slice(0, 50) : '',
    description: truncate(repo.description, 500),
    topics: Array.isArray(repo.topics) ? repo.topics.filter((topic) => typeof topic === 'string').slice(0, 30).map((topic) => topic.slice(0, 100)) : [],
    readme: truncate(repo.readme, README_EXCERPT_CHARS), languages,
    manifests: Object.fromEntries(MANIFEST_FILES.filter((file) => typeof repo.manifests?.[file] === 'string').map((file) => [file, repo.manifests[file].slice(0, 2000)])),
  };
}

export async function fetchGithubProfile(username, { cache = GitHubCache, client = http } = {}) {
  const normalized = normalizeUsername(username);
  assertRequestBudget();
  const deadline = Date.now() + FETCH_DEADLINE_MS;

  let cached;
  try {
    cached = await cache.findOne({ username: normalized });
  } catch {
    assertRequestBudget();
    cached = null;
  }
  assertRequestBudget();
  const cacheAge = cached ? Date.now() - new Date(cached.fetchedAt).getTime() : NaN;
  if (cached && Array.isArray(cached.data?.repos) && cacheAge >= 0 && cacheAge < CACHE_TTL_MS) {
    return { username: normalized, repos: cached.data.repos.slice(0, MAX_REPOS).map(boundedCachedRepo).filter(Boolean), fetchedAt: new Date(cached.fetchedAt).toISOString(), fromCache: true, partial: false };
  }

  await ghGet(`/users/${normalized}`, { client, deadline });

  const repoList = await ghGet(`/users/${normalized}/repos`, {
    params: { sort: 'pushed', per_page: MAX_REPOS },
    client,
    deadline,
  });

  if (!Array.isArray(repoList)) {
    throw new AppError('GitHub returned an invalid repository response', 503, 'github_unavailable');
  }
  const repos = [];
  let partial = false;
  for (const item of repoList.slice(0, MAX_REPOS)) {
    assertRequestBudget();
    if (Date.now() >= deadline) { partial = true; break; }
    if (!item || item.fork || item.private || typeof item.name !== 'string' || typeof item.owner?.login !== 'string' || !/^[A-Za-z0-9_.-]{1,100}$/.test(item.name ?? '') || !/^[A-Za-z0-9-]{1,39}$/.test(item.owner?.login ?? '')) continue;
    const extra = await collectRepo(item.owner.login, item.name, client, deadline);
    repos.push({
      name: item.name,
      fork: item.fork,
      pushedAt: item.pushed_at,
      language: typeof item.language === 'string' ? item.language.slice(0, 50) : '',
      description: truncate(item.description, 500),
      topics: Array.isArray(item.topics) ? item.topics.filter((topic) => typeof topic === 'string').slice(0, 30).map((topic) => topic.slice(0, 100)) : [],
      ...extra,
    });
  }

  const payload = { repos, fetchedAt: new Date().toISOString(), fromCache: false, partial: partial || Date.now() >= deadline };

  try {
    if (!payload.partial) await cache.findOneAndUpdate(
      { username: normalized },
      { $set: { username: normalized, data: payload, fetchedAt: new Date() } },
      { upsert: true }
    );
  } catch {
    assertRequestBudget();
    // GitHub enrichment remains useful even when its cache is unavailable.
  }

  return { username: normalized, ...payload };
}
