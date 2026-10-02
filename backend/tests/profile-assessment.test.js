import { describe, it, expect, vi } from 'vitest';
import { buildProfileAssessment } from '../src/services/profileAssessmentService.js';
import { buildCareerActions } from '../src/services/careerActionService.js';
import { normalizeCodingProfileUrl } from '../src/services/codingProfileService.js';
import { createDemoResumePdf } from '../scripts/demo-resumes.js';
import { extractResumeText } from '../src/services/resumeService.js';
import { assertLocalDemoDatabase } from '../scripts/demo-guard.js';
vi.mock('../src/models/resourceCatalog.js', () => ({ ResourceCatalog: {} }));

const ontology = [{ skill_name: 'Python', weight: 1 }, { skill_name: 'SQL', weight: 1 }];
const skill = { name: 'Python', sources: ['resume', 'github'], evidence: [{ source: 'resume', text: 'Built a Python API.' }, { source: 'github', text: 'Primary language: Python' }], proficiency_signals: { mentions_depth: 'high' } };

describe('source-aware profile assessment', () => {
  it('excludes missing sources, distinguishes URL-only data, and never borrows depth from another source', () => {
    const assessment = buildProfileAssessment({ resume_text: 'Built a Python API.', linkedinUrl: 'https://www.linkedin.com/in/demo/', source_evidence: { github: { available: true, repos: [] } } }, [skill], ontology);
    const byId = Object.fromEntries(assessment.sources.map((entry) => [entry.id, entry]));
    expect(byId.resume.score).toBe(50);
    expect(byId.github.roleAlignment).toBe(33);
    expect(byId.linkedin_user_provided).toMatchObject({ status: 'link_only', score: null });
    expect(byId.leetcode.score).toBeNull();
    expect(assessment.assessedSources).toBe(2);
    expect(assessment.score).toBe(Math.round((50 + byId.github.score) / 2));
  });
  it('withholds a GitHub score when a README request was unavailable', () => {
    const assessment = buildProfileAssessment({ github_username: 'demo', source_evidence: { github: { available: true, repos: [{ name: 'demo', readme: '', readmeStatus: 'unavailable' }] } } }, [skill], ontology);
    expect(assessment.sources.find((entry) => entry.id === 'github')).toMatchObject({ status: 'partial', score: null });
    expect(assessment.assessedSources).toBe(0);
  });
  it('does not invent a coding score from overlapping language counts', () => {
    const assessment = buildProfileAssessment({ source_evidence: { leetcode: { available: true, totalSolved: null, languages: [{ name: 'Python', solved: 12 }, { name: 'Java', solved: 12 }] } } }, [], ontology);
    expect(assessment.sources.find((entry) => entry.id === 'leetcode')).toMatchObject({ status: 'partial', score: null });
  });
  it('scores a known empty practice profile as zero and treats self-report as unverified', () => {
    const assessment = buildProfileAssessment({ codingSummaryText: 'Practiced Python arrays.', source_evidence: { leetcode: { available: true, totalSolved: 0, easy: 0, medium: 0, hard: 0 } } }, [], ontology);
    expect(assessment.sources.find((entry) => entry.id === 'leetcode').score).toBe(0);
    expect(assessment.sources.find((entry) => entry.id === 'coding_user_provided').status).toBe('user_provided');
    expect(assessment.assessedSources).toBe(2);
  });
});

describe('curated career actions and coding-source input', () => {
  const assessment = { assessedSources: 1, totalSources: 5 };
  it('filters invented skills and destinations and does not force DSA onto a design role', () => {
    const actions = buildCareerActions({ role: 'UI/UX Designer', plan: [{ skill: 'Figma' }], requiredSkills: ['Figma'], assessment }, { projects: [{ skill: 'React', title: 'Wrong stack' }], practiceIds: ['https://evil.example', 'lc-two-sum'] });
    expect(actions.projects[0].skill).toBe('Figma');
    expect(actions.practice).toEqual([]);
    expect(actions.posts[0].draft).toContain('I’m planning');
    expect(JSON.stringify(actions)).not.toContain('evil.example');
  });
  it('selects SQL practice for a data role from an allowlisted destination', () => {
    const actions = buildCareerActions({ role: 'Data Analyst', plan: [{ skill: 'SQL' }], requiredSkills: ['SQL'], assessment });
    expect(actions.practice.map((entry) => entry.id)).toEqual(['hr-sql']);
    expect(actions.practice[0].url).toBe('https://www.hackerrank.com/challenges/select-all-sql/problem');
  });
  it('keeps SQL practice when an engineering role also needs DSA', () => {
    const actions = buildCareerActions({ role: 'SDE', plan: [{ skill: 'SQL' }], requiredSkills: ['SQL', 'Data Structures'], assessment });
    expect(actions.practice.length).toBeLessThanOrEqual(6);
    expect(actions.practice.some((entry) => entry.id === 'hr-sql')).toBe(true);
    expect(actions.practice.some((entry) => entry.id === 'lc-two-sum')).toBe(true);
  });
  it.each(['https://evil.example/profile/demo', 'https://hackerrank.com.evil.example/profile/demo', 'https://user@hackerrank.com/profile/demo', 'http://codeforces.com/profile/demo', 'https://codechef.com/users/demo/extra'])('rejects unsafe or unsupported profile URL %s', (url) => {
    expect(() => normalizeCodingProfileUrl(url)).toThrow();
  });
  it('accepts a public profile and drops tracking queries', () => {
    expect(normalizeCodingProfileUrl('https://www.hackerrank.com/profile/demo?tracking=yes')).toBe('https://hackerrank.com/profile/demo');
  });
  it('guards demo seeds from remote and production databases', () => {
    expect(() => assertLocalDemoDatabase('mongodb://127.0.0.1:27017/vortex_demo', 'development')).not.toThrow();
    expect(() => assertLocalDemoDatabase('mongodb+srv://cluster.example/demo', 'development')).toThrow();
    expect(() => assertLocalDemoDatabase('mongodb://127.0.0.1:27017/demo', 'production')).toThrow();
  });
  it('produces a readable, labelled PDF with the candidate and role-specific skills', async () => {
    const pdf = await createDemoResumePdf({ name: 'Demo Person', email: 'demo@example.test' }, { title: 'Data Analyst' }, ['SQL', 'Pandas']);
    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
    const text = await extractResumeText(pdf);
    expect(text).toContain('Demo Person'); expect(text).toContain('demo@example.test');
    expect(text).toContain('SQL'); expect(text).toContain('Data Analyst');
    expect(text).toContain('FICTIONAL DEMO RESUME');
    expect(text).not.toContain('React');
  });
});
