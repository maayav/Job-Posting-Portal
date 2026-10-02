import { describe, expect, it } from 'vitest';
import { buildAllowedOrigins } from '../src/config/cors.js';
import { applyServerlessCors } from '../src/middleware/serverlessCors.js';

function response() {
  const headers = new Map();
  return {
    setHeader: (name, value) => headers.set(name.toLowerCase(), value),
    getHeader: (name) => headers.get(name.toLowerCase()),
    end() { this.ended = true; },
  };
}

describe('serverless preflight and health CORS', () => {
  it('trusts only configured origins in production', () => {
    expect(buildAllowedOrigins(' https://frontend.example/ ', 'production')).toEqual(['https://frontend.example']);
    expect(buildAllowedOrigins('', 'production')).toEqual([]);
    expect(buildAllowedOrigins('', 'development')).toContain('http://localhost:5173');
  });
  it('answers approved preflight before the database gate', () => {
    const res = response();
    expect(applyServerlessCors({ method: 'OPTIONS', headers: { origin: 'http://localhost:5173' } }, res)).toBe(true);
    expect(res.statusCode).toBe(204);
    expect(res.ended).toBe(true);
    expect(res.getHeader('Access-Control-Allow-Origin')).toBe('http://localhost:5173');
    expect(res.getHeader('Access-Control-Allow-Headers')).toContain('Authorization');
    expect(res.getHeader('Vary')).toContain('Origin');
  });
  it('does not reflect an unknown preflight origin', () => {
    const res = response();
    applyServerlessCors({ method: 'OPTIONS', headers: { origin: 'https://unknown.example' } }, res);
    expect(res.statusCode).toBe(204);
    expect(res.getHeader('Access-Control-Allow-Origin')).toBeUndefined();
  });
  it('adds approved origin headers to health GET without ending its response', () => {
    const res = response();
    expect(applyServerlessCors({ method: 'GET', headers: { origin: 'http://localhost:5173' } }, res)).toBe(false);
    expect(res.getHeader('Access-Control-Allow-Origin')).toBe('http://localhost:5173');
    expect(res.ended).toBeUndefined();
  });
});
