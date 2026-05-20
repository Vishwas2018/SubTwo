import { describe, expect, it, vi, beforeEach } from 'vitest';
import { checkLimit } from '@/lib/rate-limit/memory';

describe('checkLimit', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it('first request within window is allowed', () => {
    const key = `test-${Date.now()}-1`;
    const result = checkLimit(key, 5, 60_000);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(4);
  });

  it('requests up to max are allowed', () => {
    const key = `test-${Date.now()}-2`;
    for (let i = 0; i < 5; i++) {
      const r = checkLimit(key, 5, 60_000);
      expect(r.allowed).toBe(true);
    }
  });

  it('request exceeding max is denied', () => {
    const key = `test-${Date.now()}-3`;
    for (let i = 0; i < 5; i++) checkLimit(key, 5, 60_000);
    const result = checkLimit(key, 5, 60_000);
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it('bucket resets after window expires', () => {
    const key = `test-${Date.now()}-4`;
    for (let i = 0; i < 5; i++) checkLimit(key, 5, 60_000);
    expect(checkLimit(key, 5, 60_000).allowed).toBe(false);

    vi.advanceTimersByTime(60_001);

    const result = checkLimit(key, 5, 60_000);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(4);
  });

  it('remaining is 0 when at exactly max', () => {
    const key = `test-${Date.now()}-5`;
    for (let i = 0; i < 4; i++) checkLimit(key, 5, 60_000);
    const result = checkLimit(key, 5, 60_000);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(0);
  });
});
