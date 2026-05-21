// Unit tests for lib/plans/persist.ts — pure functions and mocked DB layer.
// Refs: P2-05
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { computeScheduledDate, persistGeneratedPlan } from '@/lib/plans/persist';
import { estimateCost, SONNET_PRICING } from '@/lib/ai/anthropic-client';
import { PLAN_12W_10K } from '@/tests/unit/ai/fixtures';
import type { WizardInput } from '@/lib/schemas';

// Mock supabase service client — no network in unit tests
const mockRpc = vi.fn();
vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: () => ({ rpc: mockRpc }),
}));

// ─── estimateCost ─────────────────────────────────────────────────────────────

describe('estimateCost', () => {
  it('1M input + 1M output = $18', () => {
    expect(estimateCost(1_000_000, 1_000_000)).toBeCloseTo(18, 5);
  });

  it('0 tokens = $0', () => {
    expect(estimateCost(0, 0)).toBe(0);
  });

  it('input-only cost: 1M input = $3', () => {
    expect(estimateCost(1_000_000, 0)).toBeCloseTo(SONNET_PRICING.input_per_mtok, 5);
  });

  it('output-only cost: 1M output = $15', () => {
    expect(estimateCost(0, 1_000_000)).toBeCloseTo(SONNET_PRICING.output_per_mtok, 5);
  });

  it('partial tokens: 500k input + 200k output', () => {
    const expected = (0.5 * 3) + (0.2 * 15); // $1.50 + $3.00 = $4.50
    expect(estimateCost(500_000, 200_000)).toBeCloseTo(expected, 5);
  });
});

// ─── computeScheduledDate ─────────────────────────────────────────────────────

describe('computeScheduledDate', () => {
  const START = new Date('2026-06-01T00:00:00Z');

  it('week 1 day 1 → start date', () => {
    const d = computeScheduledDate(START, 1, 1);
    expect(d.toISOString().slice(0, 10)).toBe('2026-06-01');
  });

  it('week 1 day 7 → start + 6 days', () => {
    const d = computeScheduledDate(START, 1, 7);
    expect(d.toISOString().slice(0, 10)).toBe('2026-06-07');
  });

  it('week 2 day 1 → start + 7 days', () => {
    const d = computeScheduledDate(START, 2, 1);
    expect(d.toISOString().slice(0, 10)).toBe('2026-06-08');
  });

  it('week 2 day 7 → start + 13 days', () => {
    const d = computeScheduledDate(START, 2, 7);
    expect(d.toISOString().slice(0, 10)).toBe('2026-06-14');
  });

  it('week 12 day 7 (race day) → start + 83 days', () => {
    const d = computeScheduledDate(START, 12, 7);
    expect(d.toISOString().slice(0, 10)).toBe('2026-08-23');
  });
});

// ─── persistGeneratedPlan ─────────────────────────────────────────────────────

const WIZARD_INPUT: WizardInput = {
  race_distance_km: 10,
  race_date: '2027-01-01',
  experience_level: 'intermediate',
  wizard_data: {
    weekly_km_current: 40,
    recent_race: { distance_km: 10, time_seconds: 3000, date: '2026-01-01' },
    days_per_week: 5,
    long_run_day: 'sat',
  },
};

describe('persistGeneratedPlan', () => {
  beforeEach(() => {
    mockRpc.mockReset();
  });

  it('returns planId, versionId, sessionCount on success', async () => {
    mockRpc.mockResolvedValue({
      data: { plan_id: 'plan-uuid', version_id: 'ver-uuid', session_count: 75 },
      error: null,
    });

    const result = await persistGeneratedPlan({
      userId: 'user-uuid',
      wizardInput: WIZARD_INPUT,
      generated: PLAN_12W_10K,
      generationId: 'gen-uuid',
    });

    expect(result).toEqual({ planId: 'plan-uuid', versionId: 'ver-uuid', sessionCount: 75 });
  });

  it('calls RPC with correct parameter names', async () => {
    mockRpc.mockResolvedValue({
      data: { plan_id: 'p', version_id: 'v', session_count: 1 },
      error: null,
    });

    await persistGeneratedPlan({
      userId: 'uid',
      wizardInput: WIZARD_INPUT,
      generated: PLAN_12W_10K,
      generationId: 'gid',
    });

    expect(mockRpc).toHaveBeenCalledWith('create_plan_from_generation', {
      p_user_id: 'uid',
      p_plan: expect.objectContaining({ total_weeks: 12 }),
      p_wizard: expect.objectContaining({ race_distance_km: 10 }),
      p_generation_id: 'gid',
    });
  });

  it('throws on Supabase error', async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: { message: 'FK constraint violation' },
    });

    await expect(
      persistGeneratedPlan({
        userId: 'uid',
        wizardInput: WIZARD_INPUT,
        generated: PLAN_12W_10K,
        generationId: 'gid',
      }),
    ).rejects.toThrow('Plan persistence failed: FK constraint violation');
  });
});
