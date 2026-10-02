import { describe, it, expect } from 'vitest';
import { skillSchema } from '../src/services/geminiService.js';

describe('Gemini extraction schema (schema-first prompt)', () => {
  it('accepts the full schema-first shape', () => {
    const parsed = skillSchema.parse({
      skills: [
        {
          name: 'PyTorch',
          category: 'ml_framework',
          sources: ['resume', 'github', 'linkedin_user_provided'],
          evidence: [{ source: 'resume', text: 'trained a model' }],
          proficiency_signals: { projects_count: 3, has_production_usage: true, mentions_depth: 'high' },
        },
      ],
    });
    expect(parsed.skills[0].category).toBe('ml_framework');
    expect(parsed.skills[0].proficiency_signals).toEqual({
      projects_count: 3,
      has_production_usage: true,
      mentions_depth: 'high',
    });
  });

  it('accepts user-provided LinkedIn evidence as a distinct source', () => {
    const parsed = skillSchema.parse({
      skills: [{
        name: 'React',
        sources: ['linkedin_user_provided'],
        evidence: [{ source: 'linkedin_user_provided', text: 'Built React dashboards' }],
      }],
    });
    expect(parsed.skills[0].sources).toEqual(['linkedin_user_provided']);
    expect(parsed.skills[0].evidence[0].source).toBe('linkedin_user_provided');
  });

  it('applies safe defaults when optional fields are missing', () => {
    const parsed = skillSchema.parse({ skills: [{ name: 'React' }] });
    expect(parsed.skills[0].category).toBe('other');
    expect(parsed.skills[0].sources).toEqual([]);
    expect(parsed.skills[0].evidence).toEqual([]);
    expect(parsed.skills[0].proficiency_signals).toEqual({
      projects_count: 0,
      has_production_usage: false,
      mentions_depth: 'low',
    });
  });

  it('coerces invalid category/depth to safe values and clamps projects_count', () => {
    const parsed = skillSchema.parse({
      skills: [
        {
          name: 'X',
          category: 'nonsense',
          proficiency_signals: { projects_count: 99, mentions_depth: 'extreme', has_production_usage: 'nope' },
        },
      ],
    });
    expect(parsed.skills[0].category).toBe('other');
    expect(parsed.skills[0].proficiency_signals.projects_count).toBe(5);
    expect(parsed.skills[0].proficiency_signals.mentions_depth).toBe('low');
    expect(parsed.skills[0].proficiency_signals.has_production_usage).toBe(false);
  });

  it('rejects a missing name and a non-array skills field', () => {
    expect(skillSchema.safeParse({ skills: [{ category: 'language' }] }).success).toBe(false);
    expect(skillSchema.safeParse({ skills: 'react' }).success).toBe(false);
  });
});

describe('bounded source-aware extraction schema', () => {
  it('accepts LeetCode only as an explicitly attributed source', () => {
    const result = skillSchema.parse({ skills: [{ name: 'Python', sources: ['leetcode'], evidence: [{ source: 'leetcode', text: 'Solved 10 LeetCode problems using Python.' }] }] });
    expect(result.skills[0].sources).toEqual(['leetcode']);
  });
  it('rejects unknown source labels and malformed evidence objects', () => {
    expect(skillSchema.safeParse({ skills: [{ name: 'React', sources: ['linkedin_scraped'] }] }).success).toBe(false);
    expect(skillSchema.safeParse({ skills: [{ name: 'React', evidence: [{ source: 'github', text: { unexpected: true } }] }] }).success).toBe(false);
  });
  it('bounds names, total skills, source labels, evidence count and quote length', () => {
    expect(skillSchema.safeParse({ skills: [{ name: 'x'.repeat(101) }] }).success).toBe(false);
    expect(skillSchema.safeParse({ skills: Array.from({ length: 101 }, () => ({ name: 'React' })) }).success).toBe(false);
    expect(skillSchema.safeParse({ skills: [{ name: 'React', sources: Array(5).fill('resume') }] }).success).toBe(false);
    expect(skillSchema.safeParse({ skills: [{ name: 'React', evidence: Array(9).fill({ source: 'resume', text: 'React' }) }] }).success).toBe(false);
    expect(skillSchema.safeParse({ skills: [{ name: 'React', evidence: [{ source: 'resume', text: 'x'.repeat(501) }] }] }).success).toBe(false);
  });
  it.each([-20, Infinity, NaN, 'bad'])('coerces invalid project count %s to a finite nonnegative value', (count) => {
    const result = skillSchema.parse({ skills: [{ name: 'React', proficiency_signals: { projects_count: count } }] });
    expect(Number.isFinite(result.skills[0].proficiency_signals.projects_count)).toBe(true);
    expect(result.skills[0].proficiency_signals.projects_count).toBeGreaterThanOrEqual(0);
  });
});
