import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { checkLimit } from './memory';

export type LimiterName =
  | 'signup'
  | 'login'
  | 'ai_generation'
  | 'free_ai_generation'
  | 'api_write'
  | 'api_read'
  | 'export'
  | 'invite';

type LimiterType = 'read' | 'write' | 'ai';

const LIMITER_TYPE: Record<LimiterName, LimiterType> = {
  signup: 'write',
  login: 'write',
  ai_generation: 'ai',
  free_ai_generation: 'ai',
  api_write: 'write',
  api_read: 'read',
  export: 'write',
  invite: 'write',
};

// Memory fallback config — used when Upstash is not configured (local dev)
const MEMORY_CONFIG: Record<LimiterName, { max: number; windowMs: number }> = {
  signup:            { max: 5,   windowMs: 60 * 60 * 1_000 },
  login:             { max: 5,   windowMs: 60 * 60 * 1_000 },
  ai_generation:     { max: 3,   windowMs: 24 * 60 * 60 * 1_000 },
  free_ai_generation:{ max: 10,  windowMs: 24 * 60 * 60 * 1_000 },
  api_write:         { max: 30,  windowMs: 60 * 1_000 },
  api_read:          { max: 100, windowMs: 60 * 1_000 },
  export:            { max: 1,   windowMs: 60 * 60 * 1_000 },
  invite:            { max: 5,   windowMs: 24 * 60 * 60 * 1_000 },
};

const hasUpstash = Boolean(
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN,
);

// Lazy singletons — instantiated on first use to avoid cold-start errors
// when env vars are absent.
let _redis: Redis | null = null;
let _limiters: Record<LimiterName, Ratelimit> | null = null;

function getRedis(): Redis {
  if (!_redis) {
    _redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    });
  }
  return _redis;
}

function getLimiters(): Record<LimiterName, Ratelimit> {
  if (!_limiters) {
    const r = getRedis();
    _limiters = {
      signup:             new Ratelimit({ redis: r, limiter: Ratelimit.slidingWindow(5,   '1 h'),  prefix: 'rl:signup' }),
      login:              new Ratelimit({ redis: r, limiter: Ratelimit.slidingWindow(5,   '1 h'),  prefix: 'rl:login' }),
      ai_generation:      new Ratelimit({ redis: r, limiter: Ratelimit.slidingWindow(3,   '24 h'), prefix: 'rl:ai' }),
      free_ai_generation: new Ratelimit({ redis: r, limiter: Ratelimit.slidingWindow(10,  '24 h'), prefix: 'rl:free_ai' }),
      api_write:          new Ratelimit({ redis: r, limiter: Ratelimit.slidingWindow(30,  '1 m'),  prefix: 'rl:write' }),
      api_read:           new Ratelimit({ redis: r, limiter: Ratelimit.slidingWindow(100, '1 m'),  prefix: 'rl:read' }),
      export:             new Ratelimit({ redis: r, limiter: Ratelimit.slidingWindow(1,   '1 h'),  prefix: 'rl:export' }),
      invite:             new Ratelimit({ redis: r, limiter: Ratelimit.slidingWindow(5,   '1 d'),  prefix: 'rl:invite' }),
    };
  }
  return _limiters;
}

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  /** Unix ms timestamp when the window resets */
  reset: number;
};

/**
 * Check rate limit for `key` against the named `limiter`.
 *
 * Degradation policy (Upstash unreachable):
 *   reads  → fail OPEN  (allow)
 *   writes / AI → fail CLOSED (deny)
 * This prevents a Redis outage from blocking reads while still protecting
 * write/AI endpoints that could be abused at cost.
 *
 * When UPSTASH_REDIS_REST_URL is absent, falls back to the in-process
 * memory limiter (suitable for local dev, single-instance only).
 */
export async function rateLimit(key: string, limiterName: LimiterName): Promise<RateLimitResult> {
  if (!hasUpstash) {
    const cfg = MEMORY_CONFIG[limiterName];
    const { allowed, remaining } = checkLimit(key, cfg.max, cfg.windowMs);
    return { allowed, remaining, reset: Date.now() + cfg.windowMs };
  }

  try {
    const { success, remaining, reset } = await getLimiters()[limiterName].limit(key);
    return { allowed: success, remaining, reset };
  } catch (err) {
    // Upstash unreachable — apply degradation policy
    console.warn('[rate-limit] Upstash unreachable, applying degradation policy:', err);
    const type = LIMITER_TYPE[limiterName];
    if (type === 'read') {
      return { allowed: true, remaining: 0, reset: Date.now() + 60_000 };
    }
    // fail CLOSED for write + AI
    return { allowed: false, remaining: 0, reset: Date.now() + 60_000 };
  }
}
