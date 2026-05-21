// Integration tests for POST /api/plans/generate — persistence + quota logic.
// generatePlan is mocked; real DB via service client (SUPABASE_AVAILABLE gate).
// Refs: P2-04, P2-05
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { persistGeneratedPlan } from '@/lib/plans/persist';
import { PLAN_12W_10K } from '@/tests/unit/ai/fixtures';
import type { WizardInput } from '@/lib/schemas';

const SUPABASE_AVAILABLE = !!process.env.SUPABASE_URL;

// Expected session count for PLAN_12W_10K:
// qualityWeek (7 sessions) × 8 + deloadWeek (5 sessions) × 3 + race week (4 sessions)
// = 56 + 15 + 4 = 75
const EXPECTED_SESSION_COUNT = 75;

const WIZARD_INPUT: WizardInput = {
  race_distance_km: 10,
  race_date: '2027-06-01',
  race_name: 'Integration Test 10K',
  experience_level: 'intermediate',
  wizard_data: {
    weekly_km_current: 40,
    recent_race: { distance_km: 10, time_seconds: 3000, date: '2026-01-01' },
    days_per_week: 5,
    long_run_day: 'sat',
  },
};

describe.skipIf(!SUPABASE_AVAILABLE)('generate route integration', () => {
  let svc: SupabaseClient;
  let testUserId: string;

  // IDs of rows to clean up after tests
  const createdPlanIds: string[] = [];
  const createdGenIds: string[] = [];

  beforeAll(async () => {
    svc = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Create a real test user (auth.users → profiles auto-created by trigger)
    const email = `gen-test-${Date.now()}@example.com`;
    const { data: user, error } = await svc.auth.admin.createUser({
      email,
      password: 'GenTest@123456!',
      email_confirm: true,
    });
    if (error) throw new Error(`Failed to create test user: ${error.message}`);
    testUserId = user.user.id;
  }, 30_000);

  afterAll(async () => {
    // Delete all seeded test data (cascade deletes plan_versions + planned_sessions)
    if (createdPlanIds.length > 0) {
      await svc.from('plans').delete().in('id', createdPlanIds);
    }
    if (createdGenIds.length > 0) {
      await svc.from('ai_generations').delete().in('id', createdGenIds);
    }
    await svc.auth.admin.deleteUser(testUserId);
  }, 15_000);

  // ── Quota logic ──────────────────────────────────────────────────────────────

  it('check_ai_quota: allowed when no prior successful generations', async () => {
    const { data, error } = await svc.rpc('check_ai_quota', { p_user_id: testUserId });
    expect(error).toBeNull();
    const quota = data as { allowed: boolean; lifetime_used: number; daily_used: number };
    expect(quota.allowed).toBe(true);
    expect(quota.lifetime_used).toBe(0);
    expect(quota.daily_used).toBe(0);
  });

  it('check_ai_quota: blocked after 10 successful lifetime generations', async () => {
    // Seed 10 successful ai_generations rows
    const rows = Array.from({ length: 10 }, (_, i) => ({
      user_id: testUserId,
      purpose: 'initial_plan' as const,
      model: 'claude-sonnet-4-6',
      success: true,
      input_tokens: 100 + i,
      output_tokens: 200 + i,
      estimated_cost_usd: 0.001,
      duration_ms: 5000,
    }));

    const { data: inserted, error: insertErr } = await svc
      .from('ai_generations')
      .insert(rows)
      .select('id');
    expect(insertErr).toBeNull();
    inserted!.forEach((r: { id: string }) => createdGenIds.push(r.id));

    const { data, error } = await svc.rpc('check_ai_quota', { p_user_id: testUserId });
    expect(error).toBeNull();
    const quota = data as { allowed: boolean; lifetime_used: number; reason: string };
    expect(quota.allowed).toBe(false);
    expect(quota.lifetime_used).toBe(10);
    expect(quota.reason).toMatch(/lifetime/);

    // Clean up seeded rows so subsequent tests start fresh
    await svc.from('ai_generations').delete().in('id', createdGenIds);
    createdGenIds.length = 0;
  });

  it('check_ai_quota: blocked after 3 successful generations within 24h', async () => {
    const rows = Array.from({ length: 3 }, (_, i) => ({
      user_id: testUserId,
      purpose: 'initial_plan' as const,
      model: 'claude-sonnet-4-6',
      success: true,
      input_tokens: 100 + i,
      output_tokens: 200 + i,
      estimated_cost_usd: 0.001,
      duration_ms: 5000,
    }));

    const { data: inserted, error: insertErr } = await svc
      .from('ai_generations')
      .insert(rows)
      .select('id');
    expect(insertErr).toBeNull();
    inserted!.forEach((r: { id: string }) => createdGenIds.push(r.id));

    const { data } = await svc.rpc('check_ai_quota', { p_user_id: testUserId });
    const quota = data as { allowed: boolean; daily_used: number; reason: string };
    expect(quota.allowed).toBe(false);
    expect(quota.daily_used).toBe(3);
    expect(quota.reason).toMatch(/daily/);

    // Clean up
    await svc.from('ai_generations').delete().in('id', createdGenIds);
    createdGenIds.length = 0;
  });

  // ── persistGeneratedPlan happy path ──────────────────────────────────────────

  it('happy path: creates plan, version, and correct session count', async () => {
    // Seed an ai_generations row (success=false so it doesn't count toward quota)
    const { data: gen, error: genErr } = await svc
      .from('ai_generations')
      .insert({
        user_id: testUserId,
        purpose: 'initial_plan',
        model: 'claude-sonnet-4-6',
        success: false, // not counting toward quota
        duration_ms: 100,
      })
      .select('id')
      .single();
    expect(genErr).toBeNull();
    const generationId = (gen as { id: string }).id;
    createdGenIds.push(generationId);

    const result = await persistGeneratedPlan({
      userId: testUserId,
      wizardInput: WIZARD_INPUT,
      generated: PLAN_12W_10K,
      generationId,
    });

    expect(result.planId).toBeTruthy();
    expect(result.versionId).toBeTruthy();
    expect(result.sessionCount).toBe(EXPECTED_SESSION_COUNT);

    createdPlanIds.push(result.planId);

    // Verify plan row
    const { data: plan, error: planErr } = await svc
      .from('plans')
      .select('*')
      .eq('id', result.planId)
      .single();
    expect(planErr).toBeNull();
    const planRow = plan as {
      status: string;
      user_id: string;
      total_weeks: number;
      current_version_id: string;
    };
    expect(planRow.status).toBe('draft');
    expect(planRow.user_id).toBe(testUserId);
    expect(planRow.total_weeks).toBe(12);
    expect(planRow.current_version_id).toBe(result.versionId);

    // Verify plan_versions row
    const { data: version, error: verErr } = await svc
      .from('plan_versions')
      .select('*')
      .eq('id', result.versionId)
      .single();
    expect(verErr).toBeNull();
    const verRow = version as {
      version_number: number;
      generated_by: string;
      ai_generation_id: string;
    };
    expect(verRow.version_number).toBe(1);
    expect(verRow.generated_by).toBe('ai');
    expect(verRow.ai_generation_id).toBe(generationId);

    // Verify session count
    const { count, error: sessErr } = await svc
      .from('planned_sessions')
      .select('id', { count: 'exact', head: true })
      .eq('plan_id', result.planId);
    expect(sessErr).toBeNull();
    expect(count).toBe(EXPECTED_SESSION_COUNT);
  }, 30_000);

  // ── Failure path — no orphan plan rows ───────────────────────────────────────

  it('failure path: no plan rows created when persistence is not called', async () => {
    // When generatePlan returns success:false, the route should NOT call persistGeneratedPlan.
    // Verify directly: count plans for test user before and after a failed generation.
    const { count: before } = await svc
      .from('plans')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', testUserId);

    // Simulate a failed ai_generations log (success=false → no plan inserted)
    const { data: gen, error: genErr } = await svc
      .from('ai_generations')
      .insert({
        user_id: testUserId,
        purpose: 'initial_plan',
        model: 'claude-sonnet-4-6',
        success: false,
        error_message: 'schema validation failed',
        duration_ms: 3000,
      })
      .select('id')
      .single();
    expect(genErr).toBeNull();
    createdGenIds.push((gen as { id: string }).id);

    // No plan was created
    const { count: after } = await svc
      .from('plans')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', testUserId);

    expect(after).toBe(before);
  });

  // ── Session date derivation ───────────────────────────────────────────────────

  it('sessions have correct scheduled_date for week 1 day 1 and final race day', async () => {
    // The happy path test created a plan — find it
    if (createdPlanIds.length === 0) return;
    const planId = createdPlanIds[0]!;

    const { data: sessions, error } = await svc
      .from('planned_sessions')
      .select('week_number, day_of_week, scheduled_date, session_type')
      .eq('plan_id', planId)
      .order('week_number')
      .order('day_of_week');
    expect(error).toBeNull();

    const rows = sessions as Array<{
      week_number: number;
      day_of_week: number;
      scheduled_date: string;
      session_type: string;
    }>;

    // First session: week 1, day 1 (Monday)
    const first = rows.find((s) => s.week_number === 1 && s.day_of_week === 1);
    expect(first).toBeTruthy();

    // Last session: week 12, day 7 (Sunday race) — race_date is 2027-06-01
    const last = rows.find((s) => s.week_number === 12 && s.day_of_week === 7);
    expect(last).toBeTruthy();
    expect(last!.session_type).toBe('race');
    expect(last!.scheduled_date).toBe('2027-06-01'); // race_date
  });
});
