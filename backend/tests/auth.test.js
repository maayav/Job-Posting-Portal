import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { app, initDb, closeDb, clearDb, registerUser, loginUser } from './helpers.js';

describe('Auth', () => {
  beforeAll(initDb);
  afterAll(closeDb);
  beforeEach(clearDb);

  it('registers a student and returns a JWT', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Ada', email: 'ada@test.com', password: 'secret123' });
    expect(res.status).toBe(201);
    expect(res.body.token).toBeTruthy();
    expect(res.body.user).toMatchObject({ email: 'ada@test.com', role: 'student' });
    expect(res.body.user.password).toBeUndefined();
  });

  it('rejects duplicate emails with 409', async () => {
    await registerUser({ email: 'dup@test.com' });
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Dup', email: 'dup@test.com', password: 'secret123' });
    expect(res.status).toBe(409);
    expect(res.body.error).toBe('email_taken');
  });

  it('hashes passwords with bcrypt (no plaintext stored)', async () => {
    await registerUser({ email: 'hash@test.com' });
    const { User } = await import('../src/models/user.js');
    const user = await User.findOne({ email: 'hash@test.com' }).select('+password');
    expect(user.password).not.toBe('secret123');
    expect(await user.comparePassword('secret123')).toBe(true);
    expect(await user.comparePassword('wrong')).toBe(false);
  });

  it('logs in with correct credentials and rejects wrong ones', async () => {
    await registerUser({ email: 'login@test.com' });
    const ok = await loginUser('login@test.com', 'secret123');
    expect(ok.token).toBeTruthy();

    const bad = await request(app)
      .post('/api/auth/login')
      .send({ email: 'login@test.com', password: 'nope' });
    expect(bad.status).toBe(401);
    expect(bad.body.error).toBe('invalid_credentials');
  });

  it('rejects invalid tokens', async () => {
    const res = await request(app).get('/api/profile/000000000000000000000000').set('Authorization', 'Bearer not.a.jwt');
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('invalid_token');
  });

  it('rejects expired tokens', async () => {
    const { signTokenForUser } = await import('../src/middleware/auth.middleware.js');
    const { env } = await import('../src/config/env.js');
    const jwt = (await import('jsonwebtoken')).default;
    const token = jwt.sign({ id: '000000000000000000000000', role: 'student' }, env.JWT_SECRET, { expiresIn: -10 });
    void signTokenForUser;
    const res = await request(app).get('/api/profile/000000000000000000000000').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(401);
  });

  it('requires a token for protected routes', async () => {
    const res = await request(app).get('/api/profile/000000000000000000000000');
    expect(res.status).toBe(401);
  });

  it('GET /api/health returns the exact canonical shape', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(Object.keys(res.body).sort()).toEqual(['status', 'timestamp']);
    expect(res.body.status).toBe('ok');
    expect(new Date(res.body.timestamp).toISOString()).toBe(res.body.timestamp);
  });
});