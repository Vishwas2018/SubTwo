// Integration tests for plan management: create_plan_version + activate_plan RPCs.
// Uses real DB via service client (SUPABASE_AVAILABLE gate).
// Refs: P2-06
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { persistGeneratedPlan } from '@/lib/plans/persist';
import { PLAN_12W_10K } from '@/tests/unit/ai/fixtures';
import type { WizardInput } from '@/lib/schemas';

const SUPABASE_AVAILABLE = !!process.env.SUPABASE_URL;

// Minimal interface for untyped RPCs (migrations 022)
interface UntypedRpc {
  rpc(
    fn: string,
    args: Record<string, unknown>,
  ): Promise<{ data: unknown; error: { message: string } | null }>;
}

const WIZARD_INPUT: WizardInput = {
  race_distance_km: 21.1,
  race_date: '2027-06-01',
  race_name: 'Plans API Integration Test',
  experience_level: 'intermediate',
  wizard_data: {
    weekly_km_current: 50,
    recent_race: { distance_km: 10, time_seconds: 3000, date: '2026-01-01' },
    days_per_week: 5,
    long_run_day: 'sat',
    goal_time_seconds: 7199,
  },
};

describe.skipIf(!SUPABASE_AVAILABLE)('plans API integration', () => {
  let svc: SupabaseClient;
  let testUserId: string;
  const createdPlanIds: string[] = [];
  const createdGenIds: string[] = [];

  beforeAll(async () => {
    svc = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const email = `plans-api-${Date.now()}@example.com`;
    const { data: user, error } = await svc.auth.admin.createUser({
      email,
      password: 'PlansApi@123456!',
      email_confirm: true,
    });
    if (error) throw new Error(`Failed to create test user: ${error.message}`);
    testUserId = user.user.id;
  }, 30_000);

  afterAll(async () => {
    if (createdPlanIds.length > 0) {
      await svc.from('plans').delete().in('id', createdPlanIds);
    }
    if (createdGenIds.length > 0) {
      await svc.from('ai_generations').delete().in('id', createdGenIds);
    }
    await svc.auth.admin.deleteUser(testUserId);
  }, 15_000);

  // ── create_plan_from_generation (baseline) ────────────────────────────────

  it('creates a draft plan with version 1', async () => {
    const { data: gen } = await svc
      .from('ai_generations')
      .insert({
        user_id: testUserId,
        purpose: 'initial_plan',
        model: 'claude-sonnet-4-6',
        success: true,
        duration_ms: 1000,
      })
      .select('id')
      .single();
    expect(gen).not.toBeNull();
    createdGenIds.push(gen!.id as string);

    const persisted = await persistGeneratedPlan({
      userId: testUserId,
      wizardInput: WIZARD_INPUT,
      generated: PLAN_12W_10K,
      generationId: gen!.id as string,
    });
    expect(persisted.planId).toBeTruthy();
    expect(persisted.versionId).toBeTruthy();
    createdPlanIds.push(persisted.planId);

    const { data: plan } = await svc
      .from('plans')
      .select('status, total_weeks, current_version_id')
      .eq('id', persisted.planId)
      .single();
    expect(plan?.status).toBe('draft');
    expect(plan?.total_weeks).toBe(12);
    expect(plan?.current_version_id).toBe(persisted.versionId);

    const { data: version } = await svc
      .from('plan_versions')
      .select('version_number')
      .eq('id', persisted.versionId)
      .single();
    expect(version?.version_number).toBe(1);
  });

  // ── create_plan_version (migration 022) ───────────────────────────────────

  it('create_plan_version adds version 2 and updates current_version_id', async () => {
    // Use the plan created in previous test
    const planId = createdPlanIds[0];
    expect(planId).toBeTruthy();

    const { data: gen2 } = await svc
      .from('ai_generations')
      .insert({
        user_id: testUserId,
        purpose: 'regen_full',
        model: 'claude-sonnet-4-6',
        success: true,
        duration_ms: 1000,
      })
      .select('id')
      .single();
    createdGenIds.push(gen2!.id as string);

    const svcRpc = svc as unknown as UntypedRpc;
    const { data, error } = await svcRpc.rpc('create_plan_version', {
      p_plan_id: planId,
      p_plan: PLAN_12W_10K as unknown as Record<string, unknown>,
      p_generation_id: gen2!.id as string,
    });

    expect(error).toBeNull();
    const result = data as { plan_id: string; version_id: string; version_number: number; session_count: number };
    expect(result.version_number).toBe(2);
    expect(result.session_count).toBeGreaterThan(0);

    // current_version_id should now point to version 2
    const { data: plan } = await svc
      .from('plans')
      .select('current_version_id')
      .eq('id', planId)
      .single();
    expect(plan?.current_version_id).toBe(result.version_id);

    // Version 1 should still exist
    const { count } = await svc
      .from('plan_versions')
      .select('id', { count: 'exact' })
      .eq('plan_id', planId);
    expect(count).toBe(2);
  });

  // ── activate_plan (migration 022) ─────────────────────────────────────────

  it('activate_plan promotes draft→active and archives existing active plan', async () => {
    // Create a second plan for the same user
    const { data: gen3 } = await svc
      .from('ai_generations')
      .insert({
        user_id: testUserId,
        purpose: 'initial_plan',
        model: 'claude-sonnet-4-6',
        success: true,
        duration_ms: 1000,
      })
      .select('id')
      .single();
    createdGenIds.push(gen3!.id as string);

    const p2 = await persistGeneratedPlan({
      userId: testUserId,
      wizardInput: WIZARD_INPUT,
      generated: PLAN_12W_10K,
      generationId: gen3!.id as string,
    });
    createdPlanIds.push(p2.planId);

    const planId1 = createdPlanIds[0]!;
    const planId2 = p2.planId;

    // Activate plan 1
    const svcRpc = svc as unknown as UntypedRpc;
    const { error: e1 } = await svcRpc.rpc('activate_plan', {
      p_plan_id: planId1,
      p_user_id: testUserId,
    });
    expect(e1).toBeNull();

    const { data: plan1 } = await svc.from('plans').select('status').eq('id', planId1).single();
    expect(plan1?.status).toBe('active');

    // Now activate plan 2 — plan 1 should be archived
    const { error: e2 } = await svcRpc.rpc('activate_plan', {
      p_plan_id: planId2,
      p_user_id: testUserId,
    });
    expect(e2).toBeNull();

    const { data: p1After } = await svc.from('plans').select('status').eq('id', planId1).single();
    const { data: p2After } = await svc.from('plans').select('status').eq('id', planId2).single();
    expect(p1After?.status).toBe('archived');
    expect(p2After?.status).toBe('active');
  });

  it('activate_plan rejects non-draft plan', async () => {
    const planId2 = createdPlanIds[1]!; // now active from previous test
    const svcRpc = svc as unknown as UntypedRpc;
    const { error } = await svcRpc.rpc('activate_plan', {
      p_plan_id: planId2,
      p_user_id: testUserId,
    });
    // Should fail: plan is already active, not draft
    expect(error).not.toBeNull();
  });
});
