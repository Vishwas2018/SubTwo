// Unit tests for POST /api/cron/adjustments auth guard.
// Replaces the 2 HTTP integration tests that required a live server (TD-013).
// Tests the route handler directly — no running Next.js needed.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: vi.fn(() => ({
    from: vi.fn(() => ({ select: vi.fn(() => ({ eq: vi.fn(() => ({ data: [], error: null })) })) })),
  })),
}));
vi.mock('@/lib/audit/log', () => ({ logAudit: vi.fn() }));
vi.mock('@/lib/adjustment-rules', () => ({ evaluateAdjustments: vi.fn(() => []) }));
vi.mock('@/lib/adjustments/apply', () => ({ applyAdjustment: vi.fn() }));

const { POST } = await import('@/app/api/cron/adjustments/route');

const BASE = 'http://localhost/api/cron/adjustments';

describe('POST /api/cron/adjustments — auth guard', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv, CRON_SECRET: 'test-secret-xyz' };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('returns 401 without Authorization header', async () => {
    const req = new Request(BASE, { method: 'POST' });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it('returns 401 with wrong secret', async () => {
    const req = new Request(BASE, {
      method: 'POST',
      headers: { Authorization: 'Bearer wrong-secret' },
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it('returns 401 when CRON_SECRET is not set', async () => {
    delete process.env.CRON_SECRET;
    const req = new Request(BASE, {
      method: 'POST',
      headers: { Authorization: 'Bearer test-secret-xyz' },
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });
});
