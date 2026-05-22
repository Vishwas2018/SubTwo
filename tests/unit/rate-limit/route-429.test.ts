// Unit tests for 429 responses on rate-limited routes.
// Mocks @/lib/rate-limit to deny and verifies correct 429 format.
// Refs: P3-01
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/rate-limit', () => ({
  rateLimit: vi.fn().mockResolvedValue({
    allowed: false,
    remaining: 0,
    reset: Date.now() + 3_600_000,
  }),
}));

// Supabase server must be mocked to avoid real HTTP calls in unit tests
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-123' } } }),
    },
  }),
  createServiceClient: vi.fn().mockReturnValue({
    from: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: { id: 'gen-1' }, error: null }),
  }),
}));

describe('signup route — 429 when rate limited', () => {
  it('returns 429 with code and retry_after', async () => {
    const { POST } = await import('@/app/api/auth/signup/route');
    const req = new Request('http://localhost/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-forwarded-for': '1.2.3.4' },
      body: JSON.stringify({ email: 'test@example.com', invite_code: 'ABCD1234' }),
    });

    const res = await POST(req);
    expect(res.status).toBe(429);
    const body = (await res.json()) as {
      error: { code: string; message: string; retry_after: number };
    };
    expect(body.error.code).toBe('rate_limited');
    expect(typeof body.error.retry_after).toBe('number');
    expect(body.error.retry_after).toBeGreaterThan(0);
  });
});

describe('login route — 429 when rate limited', () => {
  it('returns 429 with code and retry_after', async () => {
    const { POST } = await import('@/app/api/auth/login/route');
    const req = new Request('http://localhost/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-forwarded-for': '5.6.7.8' },
      body: JSON.stringify({ email: 'test@example.com' }),
    });

    const res = await POST(req);
    expect(res.status).toBe(429);
    const body = (await res.json()) as {
      error: { code: string; retry_after: number };
    };
    expect(body.error.code).toBe('rate_limited');
    expect(body.error.retry_after).toBeGreaterThan(0);
  });
});
