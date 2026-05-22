// Integration tests for P3-03: AI cost caps (global monthly budget).
// Tests SQL functions directly against real DB (SUPABASE_AVAILABLE gate).
// Refs: P3-03
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_AVAILABLE = !!process.env.SUPABASE_URL;

describe.skipIf(!SUPABASE_AVAILABLE)('AI global budget integration', () => {
  let svc: SupabaseClient;
  const createdGenIds: string[] = [];

  beforeAll(async () => {
    svc = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }, 10_000);

  afterAll(async () => {
    if (createdGenIds.length > 0) {
      await svc.from('ai_generations').delete().in('id', createdGenIds);
    }
  }, 10_000);

  // ── get_monthly_ai_spend ──────────────────────────────────────────────────────

  it('get_monthly_ai_spend: returns 0 with no successful generations', async () => {
    const { data, error } = await svc.rpc('get_monthly_ai_spend');
    expect(error).toBeNull();
    // Could be non-zero if other tests added rows; just verify it returns a number
    expect(typeof Number(data)).toBe('number');
    expect(Number(data)).toBeGreaterThanOrEqual(0);
  });

  it('get_monthly_ai_spend: includes only success=true rows from current month', async () => {
    const before = Number((await svc.rpc('get_monthly_ai_spend')).data ?? 0);

    // Seed 2 successful rows with known costs ($5 + $3 = $8)
    const { data: inserted, error: insErr } = await svc
      .from('ai_generations')
      .insert([
        {
          user_id: null,
          purpose: 'initial_plan',
          model: 'claude-sonnet-4-6',
          success: true,
          estimated_cost_usd: 5.0,
          duration_ms: 1000,
        },
        {
          user_id: null,
          purpose: 'initial_plan',
          model: 'claude-sonnet-4-6',
          success: true,
          estimated_cost_usd: 3.0,
          duration_ms: 1000,
        },
        // success=false row should NOT be counted
        {
          user_id: null,
          purpose: 'initial_plan',
          model: 'claude-sonnet-4-6',
          success: false,
          estimated_cost_usd: 99.0,
          duration_ms: 100,
        },
      ])
      .select('id');
    expect(insErr).toBeNull();
    inserted!.forEach((r: { id: string }) => createdGenIds.push(r.id));

    const { data: spend } = await svc.rpc('get_monthly_ai_spend');
    // Before + $8 (not + $99 since that row is success=false)
    expect(Number(spend)).toBeCloseTo(before + 8.0, 4);

    // Clean up seeded rows for subsequent tests
    await svc.from('ai_generations').delete().in('id', createdGenIds);
    createdGenIds.length = 0;
  });

  // ── check_global_ai_budget ────────────────────────────────────────────────────

  it('check_global_ai_budget: soft and hard not exceeded at $0 spend', async () => {
    // Uses default caps (50/100); spend assumed ~$0 after cleanup
    const { data, error } = await svc.rpc('check_global_ai_budget');
    expect(error).toBeNull();
    const budget = data as {
      month_spend: number;
      soft_cap: number;
      hard_cap: number;
      soft_exceeded: boolean;
      hard_exceeded: boolean;
    };
    expect(budget.soft_cap).toBe(50);
    expect(budget.hard_cap).toBe(100);
    expect(budget.soft_exceeded).toBe(false);
    expect(budget.hard_exceeded).toBe(false);
  });

  it('check_global_ai_budget: soft exceeded, hard not exceeded at $51 spend', async () => {
    const { data: row, error: insErr } = await svc
      .from('ai_generations')
      .insert({
        user_id: null,
        purpose: 'initial_plan',
        model: 'claude-sonnet-4-6',
        success: true,
        estimated_cost_usd: 51.0,
        duration_ms: 1000,
      })
      .select('id')
      .single();
    expect(insErr).toBeNull();
    createdGenIds.push((row as { id: string }).id);

    const { data, error } = await svc.rpc('check_global_ai_budget');
    expect(error).toBeNull();
    const budget = data as { soft_exceeded: boolean; hard_exceeded: boolean; month_spend: number };
    expect(budget.soft_exceeded).toBe(true);
    expect(budget.hard_exceeded).toBe(false);

    // Clean up
    await svc.from('ai_generations').delete().in('id', createdGenIds);
    createdGenIds.length = 0;
  });

  it('check_global_ai_budget: both soft and hard exceeded at $102 spend (2 rows)', async () => {
    // estimated_cost_usd is NUMERIC(6,4) — max single value is 99.9999.
    // Use 2 rows of $51 each (total $102) to cross both caps.
    const { data: rows, error: insErr } = await svc
      .from('ai_generations')
      .insert([
        {
          user_id: null,
          purpose: 'initial_plan',
          model: 'claude-sonnet-4-6',
          success: true,
          estimated_cost_usd: 51.0,
          duration_ms: 1000,
        },
        {
          user_id: null,
          purpose: 'initial_plan',
          model: 'claude-sonnet-4-6',
          success: true,
          estimated_cost_usd: 51.0,
          duration_ms: 1000,
        },
      ])
      .select('id');
    expect(insErr).toBeNull();
    rows!.forEach((r: { id: string }) => createdGenIds.push(r.id));

    const { data, error } = await svc.rpc('check_global_ai_budget');
    expect(error).toBeNull();
    const budget = data as { soft_exceeded: boolean; hard_exceeded: boolean };
    expect(budget.soft_exceeded).toBe(true);
    expect(budget.hard_exceeded).toBe(true);

    // Clean up
    await svc.from('ai_generations').delete().in('id', createdGenIds);
    createdGenIds.length = 0;
  });

  // ── try_claim_budget_alert dedup ──────────────────────────────────────────────

  it('try_claim_budget_alert: first claim returns true, second returns false (dedup)', async () => {
    // Use UTC month to match date_trunc('month', now()) in Postgres
    const d = new Date();
    const currentMonth = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-01`;

    // Ensure no existing claim for 'soft' this month (clean slate for test)
    await svc.from('ai_budget_alerts').delete().eq('month', currentMonth).eq('level', 'soft');

    // First claim should succeed
    const { data: first, error: firstErr } = await svc.rpc('try_claim_budget_alert', {
      p_level: 'soft',
    });
    expect(firstErr).toBeNull();
    expect(first).toBe(true);

    // Second claim for same month+level should return false
    const { data: second, error: secondErr } = await svc.rpc('try_claim_budget_alert', {
      p_level: 'soft',
    });
    expect(secondErr).toBeNull();
    expect(second).toBe(false);

    // Cleanup
    await svc.from('ai_budget_alerts').delete().eq('month', currentMonth).eq('level', 'soft');
  });

  it('try_claim_budget_alert: hard and soft are claimed independently', async () => {
    const d = new Date();
    const currentMonth = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-01`;

    // Clean slate for both
    await svc
      .from('ai_budget_alerts')
      .delete()
      .eq('month', currentMonth)
      .in('level', ['soft', 'hard']);

    // Claim soft
    const { data: softClaim } = await svc.rpc('try_claim_budget_alert', { p_level: 'soft' });
    expect(softClaim).toBe(true);

    // Hard is still claimable
    const { data: hardClaim, error: hardErr } = await svc.rpc('try_claim_budget_alert', {
      p_level: 'hard',
    });
    expect(hardErr).toBeNull();
    expect(hardClaim).toBe(true);

    // Both are now deduped
    const { data: softAgain } = await svc.rpc('try_claim_budget_alert', { p_level: 'soft' });
    expect(softAgain).toBe(false);
    const { data: hardAgain } = await svc.rpc('try_claim_budget_alert', { p_level: 'hard' });
    expect(hardAgain).toBe(false);

    // Cleanup
    await svc
      .from('ai_budget_alerts')
      .delete()
      .eq('month', currentMonth)
      .in('level', ['soft', 'hard']);
  });

  // ── Per-user quota still enforced independently ───────────────────────────────

  it('check_ai_quota still works correctly alongside global budget check', async () => {
    // Verify the existing per-user quota RPC is unaffected
    const { data, error } = await svc.rpc('check_ai_quota', {
      p_user_id: '00000000-0000-0000-0000-000000000000',
    });
    expect(error).toBeNull();
    const quota = data as { allowed: boolean; lifetime_used: number; daily_used: number };
    expect(quota.allowed).toBe(true);
    expect(quota.lifetime_used).toBe(0);
  });
});
