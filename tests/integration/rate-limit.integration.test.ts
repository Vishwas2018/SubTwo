// Integration tests for distributed rate limiting — memory fallback enforcement (P3-01).
// No UPSTASH_* env in .env.test → memory fallback active.
// Validates that limits are enforced correctly (n+1 request denied).
// Refs: P3-01, TD-009
import { describe, expect, it } from 'vitest';
import { rateLimit } from '@/lib/rate-limit';

describe('rate limiting — memory fallback enforcement', () => {
  it('signup: allows 5 requests, blocks 6th (same IP)', async () => {
    const ip = `192.168.100.${Math.floor(Math.random() * 254) + 1}`;
    const key = `signup:${ip}`;

    for (let i = 0; i < 5; i++) {
      const r = await rateLimit(key, 'signup');
      expect(r.allowed).toBe(true);
    }
    const blocked = await rateLimit(key, 'signup');
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
  });

  it('login: allows 5 requests, blocks 6th (same IP)', async () => {
    const ip = `10.0.50.${Math.floor(Math.random() * 254) + 1}`;
    const key = `login:${ip}`;

    for (let i = 0; i < 5; i++) {
      const r = await rateLimit(key, 'login');
      expect(r.allowed).toBe(true);
    }
    const blocked = await rateLimit(key, 'login');
    expect(blocked.allowed).toBe(false);
  });

  it('api_write: allows 30 requests, blocks 31st (same user)', async () => {
    const uid = `user-write-${Date.now()}`;
    const key = `write:${uid}`;

    for (let i = 0; i < 30; i++) {
      const r = await rateLimit(key, 'api_write');
      expect(r.allowed).toBe(true);
    }
    const blocked = await rateLimit(key, 'api_write');
    expect(blocked.allowed).toBe(false);
  });

  it('ai_generation: allows 3 requests, blocks 4th (same user)', async () => {
    const uid = `user-ai-${Date.now()}`;
    const key = `ai:${uid}`;

    for (let i = 0; i < 3; i++) {
      const r = await rateLimit(key, 'ai_generation');
      expect(r.allowed).toBe(true);
    }
    const blocked = await rateLimit(key, 'ai_generation');
    expect(blocked.allowed).toBe(false);
  });

  it('export: allows 1 request, blocks 2nd (same user)', async () => {
    const uid = `user-export-${Date.now()}`;
    const key = `export:${uid}`;

    const first = await rateLimit(key, 'export');
    expect(first.allowed).toBe(true);

    const blocked = await rateLimit(key, 'export');
    expect(blocked.allowed).toBe(false);
  });

  it('different users have independent rate limit buckets', async () => {
    const keyA = `signup:200.0.0.${Date.now() % 254}`;
    const keyB = `signup:201.0.0.${Date.now() % 254}`;

    for (let i = 0; i < 5; i++) await rateLimit(keyA, 'signup');
    const blockedA = await rateLimit(keyA, 'signup');
    expect(blockedA.allowed).toBe(false);

    const allowedB = await rateLimit(keyB, 'signup');
    expect(allowedB.allowed).toBe(true);
  });

  it('reset timestamp is in the future', async () => {
    const key = `signup:reset-test-${Date.now()}`;
    const result = await rateLimit(key, 'signup');
    expect(result.reset).toBeGreaterThan(Date.now());
  });
});
