import { describe, expect, it } from 'vitest';
import { assertDisposableTestDatabase, createTestDatabaseUri } from './test-environment.js';

describe('disposable database guard', () => {
  it('uses a unique database without changing the chosen local test port', () => {
    const first = createTestDatabaseUri('mongodb://127.0.0.1:41000/existing_data');
    const second = createTestDatabaseUri('mongodb://127.0.0.1:41000/existing_data');
    expect(first).not.toBe(second);
    expect(new URL(first).port).toBe('41000');
    expect(assertDisposableTestDatabase(first)).toMatch(/^vortex_test_/);
  });
  it.each(['mongodb://db.example/production', 'mongodb+srv://cluster.example/production', 'mongodb://127.0.0.1:27017/placement_skill_gap'])('refuses unsafe destructive targets: %s', (uri) => {
    expect(() => assertDisposableTestDatabase(uri)).toThrow();
  });
});
