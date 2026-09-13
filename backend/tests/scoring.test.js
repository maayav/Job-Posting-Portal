import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  initDb, closeDb,
} from './helpers.js';
import { computeBestMatches, computeScore, categorize, generateReport, normalizeName } from '../src/services/scoringService.js';
import { cosineSimilarity } from '../src/services/embeddingService.js';
import { ResourceCatalog } from '../src/models/resourceCatalog.js';

function vec(name) {
  const seed = [...normalizeName(name)].reduce((a, c) => a + c.charCodeAt(0), 0);
  const v = Array.from({ length: 16 }, (_, i) => Math.sin(seed * (i + 3)) * 0.5 + (i === seed % 16 ? 1 : 0));
  const norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0)) || 1;
  return v.map((x) => x / norm);
}

function ontologySkill(name, weight, vector) {
  return { skill_name: name, weight, embedding_vector: vector ?? vec(name) };
}

describe('Deterministic scoring (Section 6 formula)', () => {
  beforeAll(initDb);
  afterAll(closeDb);

  it('computes the exact weighted formula', () => {
    const a = ontologySkill('React', 0.7, [1, 0, 0]);
    const b = ontologySkill('Node.js', 0.3, [0, 1, 0]);
    const candidates = [
      { name: 'React', vector: [1, 0, 0] },
      { name: 'Node.js', vector: [0, 1, 0] },
    ];
    const perSkill = computeBestMatches([a, b], candidates);
    expect(perSkill.map((p) => p.m)).toEqual([1, 1]);
    expect(computeScore(perSkill)).toBe(100);

    const partial = [
      { skill: 'X', weight: 1, m: 0.5 },
      { skill: 'Y', weight: 1, m: 0.5 },
    ];
    expect(computeScore(partial)).toBe(50);

    const weighted = [
      { skill: 'X', weight: 0.75, m: 1 },
      { skill: 'Y', weight: 0.25, m: 0 },
    ];
    expect(computeScore(weighted)).toBe(75);
  });

  it('clamps negative similarity to zero and never exceeds 100', () => {
    const perSkill = [
      { skill: 'X', weight: 1, m: -0.3 },
      { skill: 'Y', weight: 1, m: 1.4 },
    ];
    const clamped = perSkill.map((p) => ({ ...p, m: Math.max(0, Math.min(1, p.m)) }));
    expect(computeScore(clamped)).toBe(50);
  });

  it('is deterministic — same inputs always produce the same score', async () => {
    const ontology = [
      ontologySkill('Python', 0.9),
      ontologySkill('React', 0.7),
      ontologySkill('MongoDB', 0.5),
    ];
    const candidates = [vec('python'), vec('reactjs'), vec('mongo')].map((v, i) => ({ name: ['python', 'reactjs', 'mongo'][i], vector: v }));
    const run = () => {
      const perSkill = computeBestMatches(ontology, candidates);
      return computeScore(perSkill);
    };
    const first = run();
    const second = run();
    expect(first).toBe(second);
    expect(first).toBeGreaterThanOrEqual(0);
    expect(first).toBeLessThanOrEqual(100);
  });

  it('categorizes strong / developing / gap at the 80 and 60 thresholds', () => {
    const perSkill = [
      { skill: 'A', percent: 100, weight: 0.5, m: 1 },
      { skill: 'B', percent: 79, weight: 0.5, m: 0.79 },
      { skill: 'C', percent: 60, weight: 0.5, m: 0.6 },
      { skill: 'D', percent: 59, weight: 0.5, m: 0.59 },
    ];
    const { strong, developing, gaps } = categorize(perSkill);
    expect(strong.map((s) => s.skill)).toEqual(['A']);
    expect(developing.map((s) => s.skill)).toEqual(['B', 'C']);
    expect(gaps.map((g) => g.skill)).toEqual(['D']);
  });

  it('rescales gap priorities into [0, 1] by the max raw priority', () => {
    const perSkill = [
      { skill: 'Big', percent: 10, weight: 0.9, m: 0.1 },   // raw 0.81
      { skill: 'Small', percent: 50, weight: 0.5, m: 0.5 }, // raw 0.25
    ];
    const { gaps } = categorize(perSkill);
    expect(gaps[0].priority).toBeCloseTo(1, 4);
    expect(gaps[1].priority).toBeCloseTo(0.25 / 0.81, 4);
    gaps.forEach((g) => {
      expect(g.priority).toBeGreaterThanOrEqual(0);
      expect(g.priority).toBeLessThanOrEqual(1);
    });
  });

  it('builds study-plan resources by exact (normalized) skill-name match only', async () => {
    await ResourceCatalog.insertMany([
      { skill_name: 'Express', title: 'Express Guide', url: 'https://example.com/express', type: 'documentation', verified: true },
      { skill_name: 'Express', title: 'Express Course', url: 'https://example.com/express-course', type: 'course', verified: true },
      { skill_name: 'react', title: 'React Docs', url: 'https://react.dev', type: 'documentation', verified: true },
    ]);

    const plan = await generateReport(
      [ontologySkill('Express', 0.5), ontologySkill('React', 0.5)],
      []
    );
    const expressItem = plan.study_plan.find((p) => p.skill === 'Express');
    expect(expressItem.resources).toHaveLength(2);
    const reactItem = plan.study_plan.find((p) => p.skill === 'React');
    expect(reactItem.resources).toHaveLength(1);
    expect(reactItem.resources[0].url).toBe('https://react.dev');
    expect(plan.study_plan.every((p) => p.priority >= 0 && p.priority <= 1)).toBe(true);
    const sorted = plan.study_plan.map((p) => p.priority);
    expect([...sorted].sort((a, b) => b - a)).toEqual(sorted);
  });

  it('cosine similarity of normalized vectors is symmetric and in [-1, 1]', () => {
    const a = vec('react');
    const b = vec('javascript');
    const c = vec('react');
    expect(cosineSimilarity(a, c)).toBeCloseTo(1, 6);
    expect(cosineSimilarity(a, b)).toBeCloseTo(cosineSimilarity(b, a), 6);
    expect(Math.abs(cosineSimilarity(a, b))).toBeLessThanOrEqual(1);
  });
});