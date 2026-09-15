import { describe, it, expect } from 'vitest';
import { loadOntologyFiles } from '../scripts/ontology-loader.js';

describe('Ontology seed source', () => {
  const entries = loadOntologyFiles();

  it('loads every role file, not just SDE and ML Engineer', () => {
    const roles = new Set(entries.flatMap((e) => e.roles.map((r) => r.role_name)));
    const expected = [
      'SDE',
      'ML Engineer',
      'Full-Stack Developer',
      'Backend Developer',
      'Data Scientist',
      'Data Engineer',
      'DevOps Engineer',
      'Cybersecurity Analyst',
      'QA/Test Engineer',
      'Cloud Engineer',
    ];
    expect(roles.size).toBeGreaterThanOrEqual(expected.length);
    for (const role of expected) {
      expect(roles.has(role), `missing role ${role}`).toBe(true);
    }
  });

  it('merges shared skills into one entry with a single weight per role', () => {
    const python = entries.find((e) => e.skill_name === 'Python');
    expect(python).toBeTruthy();
    expect(python.roles.length).toBeGreaterThan(1);

    const roleNames = python.roles.map((r) => r.role_name);
    expect(new Set(roleNames).size).toBe(roleNames.length);
  });

  it('keeps every role weight in (0, 1]', () => {
    for (const entry of entries) {
      for (const role of entry.roles) {
        expect(role.weight, `${entry.skill_name}/${role.role_name}`).toBeGreaterThan(0);
        expect(role.weight, `${entry.skill_name}/${role.role_name}`).toBeLessThanOrEqual(1);
      }
    }
  });
});