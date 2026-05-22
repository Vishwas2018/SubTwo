// Unit tests for lib/ai/budget.ts — mock Supabase service client.
// Refs: P3-03
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { checkBudget, getMonthlySpend, maybySendBudgetAlert, SOFT_CAP, HARD_CAP } from '@/lib/ai/budget';

// ─── Mock createServiceClient ──────────────────────────────────────────────────

const mockRpc = vi.fn();
const mockFrom = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: () => ({
    rpc: mockRpc,
    from: mockFrom,
  }),
}));

// ─── Mock global fetch (for Resend) ───────────────────────────────────────────

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

beforeEach(() => {
  vi.clearAllMocks();
  mockFetch.mockResolvedValue({ ok: true } as Response);
  // Default: from().insert() succeeds
  mockFrom.mockReturnValue({
    insert: vi.fn().mockResolvedValue({ error: null }),
  });
});

afterEach(() => {
  delete process.env.RESEND_API_KEY;
  delete process.env.INITIAL_ADMIN_EMAIL;
});

// ─── getMonthlySpend ──────────────────────────────────────────────────────────

describe('getMonthlySpend', () => {
  it('returns numeric spend from RPC', async () => {
    mockRpc.mockResolvedValue({ data: 42.5, error: null });
    expect(await getMonthlySpend()).toBe(42.5);
    expect(mockRpc).toHaveBeenCalledWith('get_monthly_ai_spend');
  });

  it('returns 0 when RPC returns null', async () => {
    mockRpc.mockResolvedValue({ data: null, error: null });
    expect(await getMonthlySpend()).toBe(0);
  });

  it('throws on RPC error', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'DB down' } });
    await expect(getMonthlySpend()).rejects.toThrow('DB down');
  });
});

// ─── checkBudget ─────────────────────────────────────────────────────────────

describe('checkBudget', () => {
  it('passes soft_cap and hard_cap constants to RPC', async () => {
    mockRpc.mockResolvedValue({
      data: { month_spend: 0, soft_cap: 50, hard_cap: 100, soft_exceeded: false, hard_exceeded: false },
      error: null,
    });
    const result = await checkBudget();
    expect(mockRpc).toHaveBeenCalledWith('check_global_ai_budget', {
      p_soft_cap: SOFT_CAP,
      p_hard_cap: HARD_CAP,
    });
    expect(result.soft_exceeded).toBe(false);
    expect(result.hard_exceeded).toBe(false);
  });

  it('returns soft_exceeded=true, hard_exceeded=false at $51', async () => {
    mockRpc.mockResolvedValue({
      data: { month_spend: 51, soft_cap: 50, hard_cap: 100, soft_exceeded: true, hard_exceeded: false },
      error: null,
    });
    const result = await checkBudget();
    expect(result.soft_exceeded).toBe(true);
    expect(result.hard_exceeded).toBe(false);
  });

  it('returns both exceeded=true at $101', async () => {
    mockRpc.mockResolvedValue({
      data: { month_spend: 101, soft_cap: 50, hard_cap: 100, soft_exceeded: true, hard_exceeded: true },
      error: null,
    });
    const result = await checkBudget();
    expect(result.soft_exceeded).toBe(true);
    expect(result.hard_exceeded).toBe(true);
  });

  it('throws on RPC error', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'timeout' } });
    await expect(checkBudget()).rejects.toThrow('timeout');
  });
});

// ─── maybySendBudgetAlert ─────────────────────────────────────────────────────

describe('maybySendBudgetAlert', () => {
  it('does nothing when try_claim_budget_alert returns false (dedup)', async () => {
    mockRpc.mockResolvedValue({ data: false, error: null });
    await maybySendBudgetAlert('soft', 51);
    expect(mockFrom).not.toHaveBeenCalled();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('does nothing when try_claim_budget_alert returns DB error', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'constraint' } });
    await maybySendBudgetAlert('soft', 51);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('writes audit_log when first claim succeeds (no RESEND_API_KEY)', async () => {
    mockRpc.mockResolvedValue({ data: true, error: null });
    const mockInsert = vi.fn().mockResolvedValue({ error: null });
    mockFrom.mockReturnValue({ insert: mockInsert });

    await maybySendBudgetAlert('soft', 51);

    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'ai_budget_soft_cap_alert',
        entity_type: 'ai_budget',
      }),
    );
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('sends Resend email when RESEND_API_KEY is set and claim succeeds', async () => {
    process.env.RESEND_API_KEY = 'test-key-123';
    process.env.INITIAL_ADMIN_EMAIL = 'admin@example.com';
    mockRpc.mockResolvedValue({ data: true, error: null });
    const mockInsert = vi.fn().mockResolvedValue({ error: null });
    mockFrom.mockReturnValue({ insert: mockInsert });

    await maybySendBudgetAlert('hard', 105);

    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.resend.com/emails',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer test-key-123' }),
      }),
    );
    const call = mockFetch.mock.calls[0]!;
    const body = JSON.parse((call[1] as { body: string }).body);
    expect(body.to).toBe('admin@example.com');
    expect(body.subject).toContain('HARD');
  });

  it('uses default admin email jvishu21@gmail.com when env not set', async () => {
    process.env.RESEND_API_KEY = 'test-key';
    mockRpc.mockResolvedValue({ data: true, error: null });
    mockFrom.mockReturnValue({ insert: vi.fn().mockResolvedValue({ error: null }) });

    await maybySendBudgetAlert('soft', 55);

    const call = mockFetch.mock.calls[0]!;
    const body = JSON.parse((call[1] as { body: string }).body);
    expect(body.to).toBe('jvishu21@gmail.com');
  });

  it('audit_log entry uses hard cap value for hard level', async () => {
    mockRpc.mockResolvedValue({ data: true, error: null });
    const mockInsert = vi.fn().mockResolvedValue({ error: null });
    mockFrom.mockReturnValue({ insert: mockInsert });

    await maybySendBudgetAlert('hard', 105);

    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'ai_budget_hard_cap_alert',
        metadata: expect.objectContaining({ cap: HARD_CAP, level: 'hard' }),
      }),
    );
  });

  it('does not throw when Resend fetch fails', async () => {
    process.env.RESEND_API_KEY = 'test-key';
    mockRpc.mockResolvedValue({ data: true, error: null });
    mockFrom.mockReturnValue({ insert: vi.fn().mockResolvedValue({ error: null }) });
    mockFetch.mockRejectedValue(new Error('network error'));

    await expect(maybySendBudgetAlert('soft', 51)).resolves.not.toThrow();
  });
});
