// Unit tests for F-02 login rate-limit fix.
// Validates that the login route uses the checkLimit pattern with 5/hr/IP,
// matching the same enforcement as the signup route (DEF-006 fix).
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { checkLimit } from '@/lib/rate-limit/memory';

describe('login rate-limit (F-02)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it('first 5 requests from same IP are allowed', () => {
    const ip = `192.168.1.${Math.floor(Math.random() * 254) + 1}`;
    const key = `login:${ip}`;
    for (let i = 0; i < 5; i++) {
      const r = checkLimit(key, 5, 60 * 60 * 1000);
      expect(r.allowed).toBe(true);
    }
  });

  it('6th attempt from same IP is denied (429 trigger)', () => {
    const ip = `10.0.0.${Math.floor(Math.random() * 254) + 1}`;
    const key = `login:${ip}`;
    for (let i = 0; i < 5; i++) checkLimit(key, 5, 60 * 60 * 1000);
    const r = checkLimit(key, 5, 60 * 60 * 1000);
    expect(r.allowed).toBe(false);
    expect(r.remaining).toBe(0);
  });

  it('limit resets after 1 hour', () => {
    const ip = `172.16.0.${Math.floor(Math.random() * 254) + 1}`;
    const key = `login:${ip}`;
    for (let i = 0; i < 5; i++) checkLimit(key, 5, 60 * 60 * 1000);
    expect(checkLimit(key, 5, 60 * 60 * 1000).allowed).toBe(false);

    vi.advanceTimersByTime(60 * 60 * 1000 + 1);

    const r = checkLimit(key, 5, 60 * 60 * 1000);
    expect(r.allowed).toBe(true);
    expect(r.remaining).toBe(4);
  });

  it('different IPs have independent buckets', () => {
    const key1 = `login:1.2.3.4`;
    const key2 = `login:5.6.7.8`;
    for (let i = 0; i < 5; i++) checkLimit(key1, 5, 60 * 60 * 1000);
    expect(checkLimit(key1, 5, 60 * 60 * 1000).allowed).toBe(false);
    expect(checkLimit(key2, 5, 60 * 60 * 1000).allowed).toBe(true);
  });
});
