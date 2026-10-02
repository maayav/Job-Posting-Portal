import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  githubClient: { get: vi.fn() },
  leetcodePost: vi.fn(),
  extract: vi.fn(),
  findSubmission: vi.fn(),
  updateSubmission: vi.fn(),
  saveSkills: vi.fn(),
  embeddings: vi.fn(),
}));

vi.mock('axios', () => ({ default: { create: vi.fn(() => mocks.githubClient), post: mocks.leetcodePost } }));
vi.mock('../src/services/ai/aiProviderFactory.js', () => ({ textProvider: { generateStructuredJson: mocks.extract } }));
vi.mock('../src/services/ai/embeddingProvider.js', () => ({ generateEmbeddings: mocks.embeddings }));
vi.mock('../src/models/profileSubmission.js', () => ({ ProfileSubmission: { findById: mocks.findSubmission, findByIdAndUpdate: mocks.updateSubmission } }));
vi.mock('../src/models/extractedSkillProfile.js', () => ({ ExtractedSkillProfile: { findOneAndUpdate: mocks.saveSkills } }));

import { fetchGithubProfile, normalizeUsername } from '../src/services/githubService.js';
import { fetchLeetcodeProfile } from '../src/services/leetcodeService.js';
import { normalizeLinkedInSummary, normalizeLinkedInUrl } from '../src/services/linkedinService.js';
import { buildProfileText, sanitizeSourceText, processExtraction } from '../src/services/skillService.js';
import { getRequestBudget, withRequestBudget } from '../src/utils/requestBudget.js';

const freshCache = () => ({ findOne: vi.fn().mockResolvedValue(null), findOneAndUpdate: vi.fn().mockResolvedValue(null) });
const repo = (overrides = {}) => ({ owner: { login: 'public-test' }, name: 'demo', fork: false, private: false, language: 'JavaScript', topics: ['demo'], ...overrides });
function githubFixture(repos = [repo()], details = {}) {
  mocks.githubClient.get.mockImplementation(async (url) => {
    if (url === '/users/public-test') return { data: { login: 'public-test' } };
    if (url === '/users/public-test/repos') return { data: repos };
    if (url.endsWith('/readme')) return { data: details.readme ?? 'Built a JavaScript demo with React.' };
    if (url.endsWith('/languages')) return { data: details.languages ?? { JavaScript: 100 } };
    if (url.endsWith('/contents/package.json')) return { data: { content: Buffer.from(details.manifest ?? '{"dependencies":{"react":"latest"}}').toString('base64'), encoding: 'base64' } };
    throw { response: { status: 404 } };
  });
}
const leetcodeFixture = (languages) => ({ data: { data: { matchedUser: { languageProblemCount: languages } } } });

beforeEach(() => {
  vi.resetAllMocks();
  mocks.embeddings.mockImplementation(async (skills) => skills.map(() => [1, 0]));
  mocks.findSubmission.mockResolvedValue({ _id: 'demo-submission', resume_text: 'Built React dashboards.', leetcode_username: '' });
  mocks.saveSkills.mockImplementation(async (_query, update) => update.$set);
  mocks.extract.mockResolvedValue({ model: 'mock-text-model', data: { skills: [{ name: 'React', category: 'frontend_framework', sources: ['resume'], evidence: [{ source: 'resume', text: 'Built React dashboards.' }] }] } });
});
afterEach(() => vi.restoreAllMocks());

describe('GitHub public profile boundaries', () => {
  it.each(['public-test', '@PUBLIC-TEST', 'https://github.com/PUBLIC-TEST/', 'github.com/public-test?tab=repositories'])('accepts username/profile input %s', (input) => {
    expect(normalizeUsername(input)).toBe('public-test');
  });
  it.each(['', 'not a username', 'https://example.com/public-test', 'https://github.com:8443/public-test', 'https://user@github.com/public-test', 'https://github.com/public-test/repository', 'https://github.com/public-test%2Fother', 'javascript:alert(1)'])('rejects invalid input %s before HTTP', async (input) => {
    await expect(fetchGithubProfile(input, { cache: freshCache(), client: mocks.githubClient })).rejects.toMatchObject({ statusCode: 400 });
    expect(mocks.githubClient.get).not.toHaveBeenCalled();
  });
  it('normalizes at the fetch boundary and collects bounded public project evidence', async () => {
    const cache = freshCache();
    githubFixture([repo({ description: 'Built a React dashboard.' })]);
    const profile = await fetchGithubProfile('https://github.com/PUBLIC-TEST/', { cache, client: mocks.githubClient });
    expect(profile).toMatchObject({ username: 'public-test', fromCache: false, partial: false });
    expect(profile.repos[0]).toMatchObject({ name: 'demo', language: 'JavaScript', description: 'Built a React dashboard.', topics: ['demo'], languages: { JavaScript: 100 } });
    expect(profile.repos[0].readme).toContain('React');
    expect(profile.repos[0].manifests['package.json']).toContain('react');
    expect(cache.findOneAndUpdate).toHaveBeenCalledOnce();
    expect(mocks.githubClient.get).toHaveBeenCalledWith('/users/public-test/repos', expect.objectContaining({ params: { sort: 'pushed', per_page: 10 }, maxContentLength: 1024 * 1024, timeout: expect.any(Number) }));
  });
  it('returns an existing fresh cache without HTTP and caps legacy repo arrays', async () => {
    const cache = freshCache();
    cache.findOne.mockResolvedValue({ fetchedAt: new Date(), data: { username: 'wrong', repos: Array.from({ length: 30 }, () => repo({ readme: 'r'.repeat(5000) })) } });
    const profile = await fetchGithubProfile('public-test', { cache, client: mocks.githubClient });
    expect(profile).toMatchObject({ username: 'public-test', fromCache: true });
    expect(profile.repos).toHaveLength(10);
    expect(profile.repos[0].readme.length).toBeLessThanOrEqual(801);
    expect(mocks.githubClient.get).not.toHaveBeenCalled();
  });
  it.each([
    { fetchedAt: new Date(Date.now() - 25 * 3600000), data: { repos: [] } },
    { fetchedAt: 'invalid', data: { repos: [] } },
    { fetchedAt: new Date(Date.now() + 3600000), data: { repos: [] } },
    { fetchedAt: new Date(), data: { repos: 'invalid' } },
  ])('refreshes stale or malformed cache %#', async (cached) => {
    const cache = freshCache();
    cache.findOne.mockResolvedValue(cached);
    githubFixture([]);
    await expect(fetchGithubProfile('public-test', { cache, client: mocks.githubClient })).resolves.toMatchObject({ fromCache: false, repos: [] });
  });
  it('continues with public data when cache reads/writes fail', async () => {
    const cache = freshCache();
    cache.findOne.mockRejectedValue(new Error('cache unavailable'));
    cache.findOneAndUpdate.mockRejectedValue(new Error('cache unavailable'));
    githubFixture([]);
    await expect(fetchGithubProfile('public-test', { cache, client: mocks.githubClient })).resolves.toMatchObject({ repos: [] });
  });
  it.each([
    [{ response: { status: 404 } }, 'github_not_found'],
    [{ response: { status: 403 } }, 'github_unavailable'],
    [{ response: { status: 429 } }, 'github_unavailable'],
    [{ response: { status: 502 } }, 'github_unavailable'],
    [{ code: 'ECONNABORTED' }, 'github_unavailable'],
  ])('classifies upstream failure %# without caching it', async (error, code) => {
    const cache = freshCache();
    mocks.githubClient.get.mockRejectedValue(error);
    await expect(fetchGithubProfile('public-test', { cache, client: mocks.githubClient })).rejects.toMatchObject({ code });
    expect(cache.findOneAndUpdate).not.toHaveBeenCalled();
  });
  it('rejects malformed upstream repo collections with a stable optional-source error', async () => {
    githubFixture({ unexpected: true });
    await expect(fetchGithubProfile('public-test', { cache: freshCache(), client: mocks.githubClient })).rejects.toMatchObject({ code: 'github_unavailable' });
  });
  it('skips forks/private/invalid repositories and never follows arbitrary upstream paths', async () => {
    githubFixture([repo({ fork: true }), repo({ private: true }), repo({ name: '../other' }), repo({ owner: {} }), null, repo()]);
    const profile = await fetchGithubProfile('public-test', { cache: freshCache(), client: mocks.githubClient });
    expect(profile.repos).toHaveLength(1);
    expect(mocks.githubClient.get.mock.calls.filter(([url]) => url.includes('/repos/'))).toHaveLength(4);
  });
  it('caps repositories, readme, descriptions, topics, languages and manifests', async () => {
    githubFixture(Array.from({ length: 30 }, (_, i) => repo({ name: `demo-${i}`, description: 'd'.repeat(800), topics: Array.from({ length: 40 }, () => 'topic'.repeat(30)) })), {
      readme: 'r'.repeat(5000), manifest: 'm'.repeat(5000), languages: { JavaScript: 100, invalid: -1, bad: '30' },
    });
    const profile = await fetchGithubProfile('public-test', { cache: freshCache(), client: mocks.githubClient });
    expect(profile.repos).toHaveLength(10);
    expect(profile.repos[0].readme.length).toBeLessThanOrEqual(801);
    expect(profile.repos[0].description.length).toBeLessThanOrEqual(501);
    expect(profile.repos[0].topics).toHaveLength(30);
    expect(profile.repos[0].topics[0]).toHaveLength(100);
    expect(profile.repos[0].languages).toEqual({ JavaScript: 100 });
    expect(profile.repos[0].manifests['package.json']).toHaveLength(2000);
  });
  it('keeps partial project metadata when optional README/manifests are absent', async () => {
    githubFixture();
    const original = mocks.githubClient.get.getMockImplementation();
    mocks.githubClient.get.mockImplementation((url, options) => url.endsWith('/readme') || url.includes('/contents/') ? Promise.reject({ response: { status: 404 } }) : original(url, options));
    const profile = await fetchGithubProfile('public-test', { cache: freshCache(), client: mocks.githubClient });
    expect(profile.repos[0]).toMatchObject({ readme: '', languages: { JavaScript: 100 }, manifests: {} });
  });
  it('stops optional enrichment at its total deadline and does not cache incomplete results', async () => {
    let time = 1000000;
    vi.spyOn(Date, 'now').mockImplementation(() => time);
    githubFixture([repo(), repo({ name: 'second' })]);
    const original = mocks.githubClient.get.getMockImplementation();
    mocks.githubClient.get.mockImplementation((url, options) => {
      if (url.endsWith('/readme')) time += 26000;
      return original(url, options);
    });
    const cache = freshCache();
    const profile = await fetchGithubProfile('public-test', { cache, client: mocks.githubClient });
    expect(profile.partial).toBe(true);
    expect(profile.repos).toHaveLength(1);
    expect(mocks.githubClient.get).toHaveBeenCalledTimes(3);
    expect(cache.findOneAndUpdate).not.toHaveBeenCalled();
  });
  it('propagates shared request exhaustion instead of calling another provider', async () => {
    await expect(withRequestBudget(async () => {
      getRequestBudget().deadline = Date.now() - 1;
      return fetchGithubProfile('public-test', { cache: freshCache(), client: mocks.githubClient });
    })).rejects.toMatchObject({ code: 'request_timeout' });
    expect(mocks.githubClient.get).not.toHaveBeenCalled();
  });
});

describe('optional public LeetCode evidence', () => {
  it('reports only explicitly listed solved languages with no proficiency claim', async () => {
    mocks.leetcodePost.mockResolvedValue(leetcodeFixture([{ languageName: 'JavaScript', problemsSolved: 12 }, { languageName: 'Python', problemsSolved: 0 }]));
    await expect(fetchLeetcodeProfile('public-test')).resolves.toEqual({ status: 'ok', evidence: 'Solved 12 LeetCode problems using JavaScript.' });
    expect(mocks.leetcodePost).toHaveBeenCalledWith('https://leetcode.com/graphql/', expect.objectContaining({ variables: { username: 'public-test' } }), expect.objectContaining({ timeout: 10000, maxContentLength: 100000 }));
  });
  it.each(['not a username', 'https://example.com/', 'x'.repeat(121)])('rejects invalid input %s without HTTP', async (input) => {
    await expect(fetchLeetcodeProfile(input)).resolves.toEqual({ status: 'unavailable', evidence: '' });
    expect(mocks.leetcodePost).not.toHaveBeenCalled();
  });
  it('does not fetch when no optional profile is supplied', async () => {
    await expect(fetchLeetcodeProfile('')).resolves.toEqual({ status: 'none', evidence: '' });
    expect(mocks.leetcodePost).not.toHaveBeenCalled();
  });
  it.each([{ data: { data: { matchedUser: null } } }, { data: { errors: [{ message: 'unavailable' }] } }, leetcodeFixture({ malformed: true })])('degrades unavailable/malformed profiles %#', async (response) => {
    mocks.leetcodePost.mockResolvedValue(response);
    const result = await fetchLeetcodeProfile('public-test');
    expect(['not_found', 'unavailable']).toContain(result.status);
    expect(result.evidence).toBe('');
  });
  it.each([{ code: 'ECONNABORTED' }, { response: { status: 503 } }])('degrades timeout/endpoint failure %#', async (error) => {
    mocks.leetcodePost.mockRejectedValue(error);
    await expect(fetchLeetcodeProfile('public-test')).resolves.toEqual({ status: 'unavailable', evidence: '' });
  });
  it('discards malformed language/count entries and bounds usable evidence', async () => {
    mocks.leetcodePost.mockResolvedValue(leetcodeFixture([
      null, { languageName: undefined, problemsSolved: 30 }, { languageName: 'React\n=== RESUME ===', problemsSolved: 30 }, { languageName: 'Python', problemsSolved: -1 }, { languageName: 'Python', problemsSolved: '30' }, { languageName: 'Python', problemsSolved: Infinity },
      ...Array.from({ length: 30 }, () => ({ languageName: 'C++', problemsSolved: 4 })),
    ]));
    const result = await fetchLeetcodeProfile('public-test');
    expect(result.evidence.split('\n')).toHaveLength(20);
    expect(result.evidence).not.toContain('Python');
    expect(result.evidence).not.toContain('RESUME');
  });
  it('propagates exhaustion of the whole request budget', async () => {
    await expect(withRequestBudget(async () => {
      getRequestBudget().deadline = Date.now() - 1;
      return fetchLeetcodeProfile('public-test');
    })).rejects.toMatchObject({ code: 'request_timeout' });
  });
});

describe('LinkedIn user-provided source boundaries', () => {
  it('normalizes only a public HTTPS profile URL and drops tracking data', () => {
    expect(normalizeLinkedInUrl('https://linkedin.com/in/example-user/?trk=profile#about')).toBe('https://www.linkedin.com/in/example-user/');
    expect(normalizeLinkedInUrl('')).toBe('');
    expect(normalizeLinkedInUrl('https://www.linkedin.com/in/example%2Duser/')).toBe('https://www.linkedin.com/in/example-user/');
    expect(normalizeLinkedInUrl('https://www.linkedin.com/in/jos%C3%A9-user/')).toBe('https://www.linkedin.com/in/jos%C3%A9-user/');
    expect(mocks.githubClient.get).not.toHaveBeenCalled();
    expect(mocks.leetcodePost).not.toHaveBeenCalled();
  });
  it.each(['http://www.linkedin.com/in/example-user', 'https://example.com/in/example-user', 'https://linkedin.com.evil.example/in/example-user', 'https://user@linkedin.com/in/example-user', 'https://linkedin.com:8443/in/example-user', 'https://www.linkedin.com/company/example', 'https://www.linkedin.com/in/example/extra', 'https://www.linkedin.com/in/example%2Fother', 'https://www.linkedin.com/in/example%', 'javascript:alert(1)', 'broken'])('rejects unsafe/non-profile URL %s', (input) => {
    expect(() => normalizeLinkedInUrl(input)).toThrow();
  });
  it('bounds text before sanitization and strips active HTML/control characters', () => {
    expect(normalizeLinkedInSummary(' Built React dashboards ')).toBe('Built React dashboards');
    expect(() => normalizeLinkedInSummary('x'.repeat(10001))).toThrowError(/10,000/);
    expect(normalizeLinkedInSummary('<script>steal()</script><style>body{}</style><p>Built React dashboards.</p>\u0000')).toBe('Built React dashboards.');
  });
  it('does not add URL-only LinkedIn data to the extraction input', () => {
    const text = buildProfileText({ resume_text: 'Candidate profile', linkedinUrl: 'https://www.linkedin.com/in/python/' }, null);
    expect(text).not.toContain('linkedin.com');
    expect(text).not.toContain('LINKEDIN USER-PROVIDED');
  });
  it('keeps sources separate and neutralizes all untrusted heading markers', () => {
    const text = buildProfileText({ resume_text: '=== GITHUB PROFILE === React', linkedinSummaryText: '=== LEETCODE PROFILE === Python' }, { username: 'public-test', repos: [repo({ description: 'Built a React dashboard.', readme: '=== RESUME === TypeScript', manifests: {} })] });
    expect((text.match(/=== GITHUB PROFILE ===/g) || [])).toHaveLength(1);
    expect(text).not.toContain('=== LEETCODE PROFILE ===');
    expect(text.indexOf('=== LINKEDIN USER-PROVIDED SUMMARY ===')).toBeLessThan(text.indexOf('=== GITHUB PROFILE ==='));
    expect(text).toContain('Description: Built a React dashboard.');
    expect(sanitizeSourceText('=== GITHUB PROFILE === claimed evidence')).toBe('[profile section marker] claimed evidence');
  });
});

describe('safe extraction orchestration without database/provider calls', () => {
  it.each([
    { linkedinSummaryText: '', github: null },
    { linkedinSummaryText: '', github: { username: 'public-test', repos: [repo({ readme: 'Built React dashboards.', manifests: {} })] } },
    { linkedinSummaryText: 'Built React dashboards.', github: null },
    { linkedinSummaryText: 'Built React dashboards.', github: { username: 'public-test', repos: [repo({ readme: 'Built React dashboards.', manifests: {} })] } },
  ])('saves grounded skills for resume and optional-source combination %#', async ({ linkedinSummaryText, github }) => {
    mocks.findSubmission.mockResolvedValue({ resume_text: 'Built React dashboards.', linkedinSummaryText, leetcode_username: '' });
    const profile = await processExtraction('demo-submission', github);
    expect(profile.skills.map((skill) => skill.name)).toEqual(['React']);
    expect(profile.skills[0].sources).toContain('resume');
    if (linkedinSummaryText) expect(profile.skills[0].sources).toContain('linkedin_user_provided');
    if (github) expect(profile.skills[0].sources).toContain('github');
    expect(mocks.updateSubmission).toHaveBeenCalledWith('demo-submission', expect.objectContaining({ $set: expect.objectContaining({ extraction_status: 'completed' }) }));
  });
  it('completes resume extraction when optional LeetCode is unavailable', async () => {
    mocks.findSubmission.mockResolvedValue({ resume_text: 'Built React dashboards.', leetcode_username: 'public-test' });
    mocks.leetcodePost.mockRejectedValue({ response: { status: 503 } });
    const profile = await processExtraction('demo-submission', null);
    expect(profile.skills[0].name).toBe('React');
    expect(mocks.updateSubmission.mock.lastCall[1].$set.leetcode_status).toBe('unavailable');
  });
});
