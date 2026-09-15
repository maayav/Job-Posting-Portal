import { describe, it, expect } from 'vitest';
import { skillSchema } from '../src/services/geminiService.js';

describe('Gemini extraction schema (schema-first prompt)', () => {
  it('accepts the full schema-first shape', () => {
    const parsed = skillSchema.parse({
      skills: [
        {
          name: 'PyTorch',
          category: 'ml_framework',
          sources: ['resume', 'github'],
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