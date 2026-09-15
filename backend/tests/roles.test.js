import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { app, initDb, closeDb, clearDb, registerUser, authHeader, seedTestOntology } from './helpers.js';

describe('Target roles endpoint', () => {
  let token;

  beforeAll(initDb);
  afterAll(closeDb);

  beforeEach(async () => {
    await clearDb();
    token = (await registerUser({ email: 'roles@test.com' })).token;
  });

  it('requires authentication (401 without a token)', async () => {
    const res = await request(app).get('/api/roles');
    expect(res.status).toBe(401);
  });

  it('returns every role present in SkillOntology, with display labels', async () => {
    await seedTestOntology(); // seeds SDE

    const { SkillOntology } = await import('../src/models/skillOntology.js');
    await SkillOntology.create({
      skill_name: 'Data Analysis',
      category: 'data',
      embedding_model: 'test-model',
      embedding_version: 'test',
      embedding_vector: [1, 0, 0],
      roles: [{ role_name: 'Data Scientist', weight: 0.8 }],
    });

    const res = await request(app).get('/api/roles').set(authHeader(token));
    expect(res.status).toBe(200);

    const ids = res.body.roles.map((r) => r.id);
    expect(ids).toContain('SDE');
    expect(ids).toContain('Data Scientist');

    const sde = res.body.roles.find((r) => r.id === 'SDE');
    expect(sde.label).toBe('Software Development Engineer');

    // Unknown roles fall back to their raw id, so new seed roles need no code change.
    const ds = res.body.roles.find((r) => r.id === 'Data Scientist');
    expect(ds.label).toBe('Data Scientist');
  });

  it('returns an empty list when the ontology has no roles', async () => {
    const res = await request(app).get('/api/roles').set(authHeader(token));
    expect(res.status).toBe(200);
    expect(res.body.roles).toEqual([]);
  });
});