// Integration tests for checkpoints API.
// Tests call Supabase directly (no HTTP server). Skipped in CI without SUPABASE_URL.
// Refs: P2-11
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { computeVerdict } from '../../lib/checkpoint-logic';

const SUPABASE_AVAILABLE = !!process.env.SUPABASE_URL;

const TARGET_SECONDS = 1500; // 25:00

describe.skipIf(!SUPABASE_AVAILABLE)('checkpoints integration', () => {
  let svc: SupabaseClient;
  let testUserId: string;
  let planId: string;
  const createdIds: string[] = [];

  beforeAll(async () => {
    svc = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const email = `cp-test-${Date.now()}@example.com`;
    const { data: u, error } = await svc.auth.admin.createUser({
      email,
      password: 'CpTest@123456!',
      email_confirm: true,
    });
    if (error) throw new Error(`Failed to create test user: ${error.message}`);
    testUserId = u.user.id;

    // Create a minimal plan so we have a plan_id to attach checkpoints to
    const { data: plan, error: planErr } = await svc
      .from('plans')
      .insert({
        user_id: testUserId,
        status: 'active',
        race_distance_km: 42.2,
        race_date: '2027-04-01',
        start_date: '2026-06-01',
        total_weeks: 16,
        experience_level: 'intermediate',
        baseline_data: {},
        pace_zones: {},
      })
      .select('id')
      .single();
    if (planErr || !plan) throw new Error(`Failed to create test plan: ${planErr?.message}`);
    planId = plan.id as string;
  }, 30_000);

  afterAll(async () => {
    if (createdIds.length > 0) {
      await svc.from('checkpoints').delete().in('id', createdIds);
    }
    await svc.from('plans').delete().eq('id', planId);
    await svc.auth.admin.deleteUser(testUserId);
  }, 15_000);

  it('inserts a checkpoint with verdict: green (result faster than target)', async () => {
    // result 1450s vs target 1500s → deviation = (1500-1450)/1500*100 ≈ 3.3% → green
    const { data, error } = await svc
      .from('checkpoints')
      .insert({
        user_id: testUserId,
        plan_id: planId,
        checkpoint_type: '5K time trial',
        target_week: 4,
        actual_date: '2026-07-01',
        result_seconds: 1450,
        target_seconds: TARGET_SECONDS,
        verdict: 'green',
        pct_deviation: ((TARGET_SECONDS - 1450) / TARGET_SECONDS) * 100,
        recommended_action: 'On track — maintain current training load.',
      })
      .select('id, verdict, pct_deviation, checkpoint_type')
      .single();

    expect(error).toBeNull();
    expect(data).not.toBeNull();
    expect(data!.verdict).toBe('green');
    expect(data!.pct_deviation).toBeCloseTo(3.33, 1);
    expect(data!.checkpoint_type).toBe('5K time trial');
    createdIds.push(data!.id as string);
  });

  it('inserts a checkpoint with verdict: amber (3–10% behind target)', async () => {
    // result 1600s vs target 1500s → deviation = (1500-1600)/1500*100 ≈ -6.7% → amber
    const { data, error } = await svc
      .from('checkpoints')
      .insert({
        user_id: testUserId,
        plan_id: planId,
        checkpoint_type: '10K time trial',
        target_week: 8,
        actual_date: '2026-07-15',
        result_seconds: 1600,
        target_seconds: TARGET_SECONDS,
        verdict: 'amber',
        pct_deviation: ((TARGET_SECONDS - 1600) / TARGET_SECONDS) * 100,
        recommended_action: 'Slightly behind — consider adding one easy run per week.',
      })
      .select('id, verdict, pct_deviation')
      .single();

    expect(error).toBeNull();
    expect(data!.verdict).toBe('amber');
    expect(data!.pct_deviation).toBeCloseTo(-6.67, 1);
    createdIds.push(data!.id as string);
  });

  it('inserts a checkpoint with verdict: red (>10% behind target)', async () => {
    // result 1700s vs target 1500s → deviation = (1500-1700)/1500*100 ≈ -13.3% → red
    const { data, error } = await svc
      .from('checkpoints')
      .insert({
        user_id: testUserId,
        plan_id: planId,
        checkpoint_type: 'Half marathon',
        target_week: 12,
        actual_date: '2026-08-01',
        result_seconds: 1700,
        target_seconds: TARGET_SECONDS,
        verdict: 'red',
        pct_deviation: ((TARGET_SECONDS - 1700) / TARGET_SECONDS) * 100,
        recommended_action: 'Significantly behind — reassess weekly mileage.',
      })
      .select('id, verdict, pct_deviation')
      .single();

    expect(error).toBeNull();
    expect(data!.verdict).toBe('red');
    expect(data!.pct_deviation).toBeCloseTo(-13.33, 1);
    createdIds.push(data!.id as string);
  });

  it('returns only checkpoints for the current plan (RLS: service key bypasses but user_id filter applied)', async () => {
    const { data } = await svc
      .from('checkpoints')
      .select('id, checkpoint_type, verdict')
      .eq('plan_id', planId)
      .eq('user_id', testUserId);

    expect(data).not.toBeNull();
    // All 3 checkpoint types should be present
    const types = (data ?? []).map((c) => c.checkpoint_type);
    expect(types).toContain('5K time trial');
    expect(types).toContain('10K time trial');
    expect(types).toContain('Half marathon');
  });

  it('computes correct verdict boundaries via checkpoint-logic', () => {
    // Boundary: exactly -3% → green
    expect(computeVerdict(-3)).toBe('green');
    // Boundary: -3.001% → amber
    expect(computeVerdict(-3.001)).toBe('amber');
    // Boundary: exactly -10% → amber
    expect(computeVerdict(-10)).toBe('amber');
    // Boundary: -10.001% → red
    expect(computeVerdict(-10.001)).toBe('red');
    // Positive (faster): green
    expect(computeVerdict(5)).toBe('green');
  });
});
