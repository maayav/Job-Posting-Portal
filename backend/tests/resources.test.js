import { beforeAll, afterAll, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import { initDb, closeDb, clearDb } from './helpers.js';
import { ResourceCatalog } from '../src/models/resourceCatalog.js';
import { hydrateStudyPlan, safeResource } from '../src/services/resourceService.js';
import { loadResourceEntries, loadOntologyFiles } from '../scripts/ontology-loader.js';

describe('Curated learning resources', () => {
  beforeAll(initDb);
  afterAll(closeDb);
  beforeEach(clearDb);

  it('covers every analysis skill and every demo job skill with a safe curated destination', () => {
    const entries = loadResourceEntries();
    const seed = fs.readFileSync(new URL('../scripts/seed-jobs.js', import.meta.url), 'utf8');
    const jobSkills = [...seed.matchAll(/skills: \[([^\]]+)\]/g)].flatMap((match) => [...match[1].matchAll(/'([^']+)'/g)].map((value) => value[1]));
    const required = [...loadOntologyFiles().map((entry) => entry.skill_name), ...jobSkills];
    const missing = required.filter((skill) => !entries.some((resource) => resource.skill_name.toLowerCase() === skill.toLowerCase() && safeResource(resource)));
    expect([...new Set(missing)]).toEqual([]);
  });

  it('refreshes old reports by skill, preserves completion and IDs, and resolves aliases', async () => {
    await ResourceCatalog.create([
      { skill_name: '.NET', title: 'Microsoft .NET', url: 'https://learn.microsoft.com/en-us/dotnet/', type: 'documentation' },
      { skill_name: 'React', title: 'React docs', url: 'https://react.dev/', type: 'documentation' },
    ]);
    const items = await hydrateStudyPlan([
      { _id: 'kept-id', skill: 'dotnet', done: true, priority: 1, resources: [{ url: 'https://react.dev/' }], reason: 'Build APIs' },
      { skill: 'Uncatalogued technology', resources: [{ url: 'https://react.dev/' }], done: false },
    ]);
    expect(items[0]).toMatchObject({ _id: 'kept-id', done: true, reason: 'Build APIs' });
    expect(items[0].resources.map((resource) => resource.url)).toEqual(['https://learn.microsoft.com/en-us/dotnet/']);
    expect(items[1].resources).toEqual([]);
  });

  it('excludes unsafe, unverified and duplicate destinations', async () => {
    await ResourceCatalog.create([
      { skill_name: 'React', title: 'Unsafe', url: 'file:///private', type: 'documentation' },
      { skill_name: 'React', title: 'Unverified', url: 'https://example.com/', type: 'documentation', verified: false },
      { skill_name: 'React', title: 'Docs', url: 'https://react.dev/', type: 'documentation' },
      { skill_name: 'reactjs', title: 'Duplicate', url: 'https://react.dev/', type: 'documentation' },
    ]);
    const [item] = await hydrateStudyPlan([{ skill: 'React' }]);
    expect(item.resources).toHaveLength(1);
    expect(item.resources[0].url).toBe('https://react.dev/');
  });
});
