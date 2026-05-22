import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mockLimit = vi.fn();

// Redis must be a proper class (used with `new`) — vitest requires function/class constructor
vi.mock('@upstash/redis', () => ({
  Redis: class MockRedis {
    constructor(_opts: unknown) {}
  },
}));

// Ratelimit must also be a proper class; static slidingWindow is attached to the class
vi.mock('@upstash/ratelimit', () => {
  class MockRatelimit {
    limit: ReturnType<typeof vi.fn>;
    constructor(_opts: unknown) {
      this.limit = mockLimit;
    }
    static slidingWindow(_n: number, _w: string) {
      return {};
    }
  }
  return { Ratelimit: MockRatelimit };
});

vi.mock('@/lib/rate-limit/memory', () => ({
  checkLimit: vi.fn().mockReturnValue({ allowed: true, remaining: 4 }),
}));

describe('rateLimit (Upstash path)', () => {
  const ORIG_ENV = process.env;

  beforeEach(() => {
    vi.resetModules();
    mockLimit.mockReset();
    process.env = {
      ...ORIG_ENV,
      UPSTASH_REDIS_REST_URL: 'https://test.upstash.io',
      UPSTASH_REDIS_REST_TOKEN: 'test-token',
    };
  });

  afterEach(() => {
    process.env = ORIG_ENV;
  });

  it('returns allowed=true when Upstash permits', async () => {
    const reset = Date.now() + 3_600_000;
    mockLimit.mockResolvedValueOnce({ success: true, remaining: 4, reset });
    const { rateLimit } = await import('@/lib/rate-limit');
    const result = await rateLimit('test-key', 'signup');
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(4);
    expect(mockLimit).toHaveBeenCalledWith('test-key');
  });

  it('returns allowed=false when Upstash denies', async () => {
    mockLimit.mockResolvedValueOnce({ success: false, remaining: 0, reset: Date.now() + 1000 });
    const { rateLimit } = await import('@/lib/rate-limit');
    const result = await rateLimit('test-key', 'login');
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it('fail-open for reads when Upstash is unreachable', async () => {
    mockLimit.mockRejectedValueOnce(new Error('Connection refused'));
    const { rateLimit } = await import('@/lib/rate-limit');
    const result = await rateLimit('test-key', 'api_read');
    expect(result.allowed).toBe(true);
  });

  it('fail-closed for writes when Upstash is unreachable', async () => {
    mockLimit.mockRejectedValueOnce(new Error('Connection refused'));
    const { rateLimit } = await import('@/lib/rate-limit');
    const result = await rateLimit('test-key', 'api_write');
    expect(result.allowed).toBe(false);
  });

  it('fail-closed for AI generation when Upstash is unreachable', async () => {
    mockLimit.mockRejectedValueOnce(new Error('Connection refused'));
    const { rateLimit } = await import('@/lib/rate-limit');
    const result = await rateLimit('test-key', 'ai_generation');
    expect(result.allowed).toBe(false);
  });

  it('fail-closed for signup (write) when Upstash unreachable', async () => {
    mockLimit.mockRejectedValueOnce(new Error('timeout'));
    const { rateLimit } = await import('@/lib/rate-limit');
    const result = await rateLimit('test-key', 'signup');
    expect(result.allowed).toBe(false);
  });

  it('fail-closed for export when Upstash unreachable', async () => {
    mockLimit.mockRejectedValueOnce(new Error('timeout'));
    const { rateLimit } = await import('@/lib/rate-limit');
    const result = await rateLimit('test-key', 'export');
    expect(result.allowed).toBe(false);
  });

  it('returns reset timestamp from Upstash', async () => {
    const futureReset = Date.now() + 86_400_000;
    mockLimit.mockResolvedValueOnce({ success: true, remaining: 2, reset: futureReset });
    const { rateLimit } = await import('@/lib/rate-limit');
    const result = await rateLimit('ai-user-123', 'ai_generation');
    expect(result.reset).toBe(futureReset);
  });
});

describe('rateLimit (memory fallback path)', () => {
  const ORIG_ENV = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...ORIG_ENV };
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
  });

  afterEach(() => {
    process.env = ORIG_ENV;
  });

  it('uses memory fallback and returns allowed=true', async () => {
    const { checkLimit } = await import('@/lib/rate-limit/memory');
    vi.mocked(checkLimit).mockReturnValueOnce({ allowed: true, remaining: 3 });
    const { rateLimit } = await import('@/lib/rate-limit');
    const result = await rateLimit('mem-key', 'signup');
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(3);
  });

  it('memory fallback passes correct max + windowMs for signup', async () => {
    const { checkLimit } = await import('@/lib/rate-limit/memory');
    vi.mocked(checkLimit).mockReturnValueOnce({ allowed: false, remaining: 0 });
    const { rateLimit } = await import('@/lib/rate-limit');
    await rateLimit('mem-key-2', 'login');
    expect(checkLimit).toHaveBeenCalledWith('mem-key-2', 5, 3_600_000);
  });

  it('memory fallback for ai_generation uses 24h window', async () => {
    const { checkLimit } = await import('@/lib/rate-limit/memory');
    vi.mocked(checkLimit).mockReturnValueOnce({ allowed: true, remaining: 2 });
    const { rateLimit } = await import('@/lib/rate-limit');
    await rateLimit('mem-key-3', 'ai_generation');
    expect(checkLimit).toHaveBeenCalledWith('mem-key-3', 3, 24 * 3_600_000);
  });

  it('reset is set to approx now + window', async () => {
    const { checkLimit } = await import('@/lib/rate-limit/memory');
    vi.mocked(checkLimit).mockReturnValueOnce({ allowed: true, remaining: 2 });
    const { rateLimit } = await import('@/lib/rate-limit');
    const before = Date.now();
    const result = await rateLimit('mem-key-4', 'ai_generation');
    const expected = before + 24 * 60 * 60 * 1_000;
    expect(result.reset).toBeGreaterThanOrEqual(expected - 50);
    expect(result.reset).toBeLessThanOrEqual(expected + 500);
  });
});
