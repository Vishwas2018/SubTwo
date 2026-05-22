// Integration tests for run logging + daily check-in.
// Tests call Supabase directly (no HTTP server). Skipped in CI without SUPABASE_URL.
// Refs: P2-09, P2-10
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_AVAILABLE = !!process.env.SUPABASE_URL;

describe.skipIf(!SUPABASE_AVAILABLE)('runs + checkins integration', () => {
  let svc: SupabaseClient;
  let testUserId: string;
  const createdRunIds: string[] = [];
  const createdCheckinIds: string[] = [];

  beforeAll(async () => {
    svc = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const email = `runs-test-${Date.now()}@example.com`;
    const { data: u, error } = await svc.auth.admin.createUser({
      email,
      password: 'RunsTest@123456!',
      email_confirm: true,
    });
    if (error) throw new Error(`Failed to create test user: ${error.message}`);
    testUserId = u.user.id;
  }, 30_000);

  afterAll(async () => {
    if (createdRunIds.length > 0) {
      await svc.from('runs').delete().in('id', createdRunIds);
    }
    if (createdCheckinIds.length > 0) {
      await svc.from('daily_checkins').delete().in('id', createdCheckinIds);
    }
    await svc.auth.admin.deleteUser(testUserId);
  }, 15_000);

  // ── POST /api/runs equivalent — insert + shape check ─────────────────────
  // Note: avg_pace_seconds is GENERATED ALWAYS — Postgres computes it from
  // distance_km and duration_seconds; never inserted directly.

  it('inserts a manual run with required fields', async () => {
    const { data, error } = await svc
      .from('runs')
      .insert({
        user_id: testUserId,
        source: 'manual',
        run_date: '2026-05-22',
        distance_km: 10.0,
        duration_seconds: 3600,
        stitch_occurred: false,
      })
      .select('id, source, distance_km, duration_seconds, avg_pace_seconds, stitch_occurred, deleted_at')
      .single();

    expect(error).toBeNull();
    expect(data).not.toBeNull();
    expect(data!.source).toBe('manual');
    expect(data!.distance_km).toBe(10);
    expect(data!.duration_seconds).toBe(3600);
    // avg_pace_seconds is auto-computed: 3600 / 10 = 360
    expect(data!.avg_pace_seconds).toBe(360);
    expect(data!.stitch_occurred).toBe(false);
    expect(data!.deleted_at).toBeNull();
    createdRunIds.push(data!.id as string);
  });

  it('inserts a run with all optional fields', async () => {
    const { data, error } = await svc
      .from('runs')
      .insert({
        user_id: testUserId,
        source: 'manual',
        run_date: '2026-05-21',
        distance_km: 5.5,
        duration_seconds: 1800,
        avg_hr: 155,
        max_hr: 172,
        elevation_gain_m: 80,
        avg_cadence: 175,
        rpe: 7,
        felt_easy: false,
        stitch_occurred: true,
        stitch_severity: 4,
        shoes: 'Nike Pegasus 41',
        notes: 'Felt heavy but finished strong.',
      })
      .select('id, rpe, stitch_occurred, stitch_severity, shoes, avg_pace_seconds')
      .single();

    expect(error).toBeNull();
    expect(data!.rpe).toBe(7);
    expect(data!.stitch_occurred).toBe(true);
    expect(data!.stitch_severity).toBe(4);
    expect(data!.shoes).toBe('Nike Pegasus 41');
    // avg_pace_seconds auto-computed: 1800 / 5.5 = 327
    expect(data!.avg_pace_seconds).toBe(327);
    createdRunIds.push(data!.id as string);
  });

  it('soft-deletes a run (deleted_at set)', async () => {
    const runId = createdRunIds[0];
    expect(runId).toBeTruthy();

    const now = new Date().toISOString();
    const { error } = await svc
      .from('runs')
      .update({ deleted_at: now })
      .eq('id', runId!);

    expect(error).toBeNull();

    const { data } = await svc.from('runs').select('deleted_at').eq('id', runId!).single();
    expect(data!.deleted_at).not.toBeNull();
  });

  it('soft-deleted run is excluded from is(deleted_at, null) queries', async () => {
    const runId = createdRunIds[0];
    expect(runId).toBeTruthy();

    const { data } = await svc
      .from('runs')
      .select('id')
      .eq('id', runId!)
      .is('deleted_at', null)
      .maybeSingle();

    expect(data).toBeNull();
  });

  // ── checkin upsert ────────────────────────────────────────────────────────

  it('inserts a check-in for today', async () => {
    const { data, error } = await svc
      .from('daily_checkins')
      .insert({
        user_id: testUserId,
        checkin_date: '2026-05-22',
        sleep_hours: 7.5,
        resting_hr: 52,
        energy_1to5: 4,
        mood_1to5: 3,
        niggle_today: false,
        notes: 'Legs a bit tired.',
      })
      .select('id, sleep_hours, resting_hr, energy_1to5, mood_1to5')
      .single();

    expect(error).toBeNull();
    expect(data!.sleep_hours).toBe(7.5);
    expect(data!.resting_hr).toBe(52);
    expect(data!.energy_1to5).toBe(4);
    expect(data!.mood_1to5).toBe(3);
    createdCheckinIds.push(data!.id as string);
  });

  it('upserts the same checkin_date → updates existing row', async () => {
    const { data, error } = await svc
      .from('daily_checkins')
      .upsert(
        {
          user_id: testUserId,
          checkin_date: '2026-05-22',
          sleep_hours: 8.0,
          energy_1to5: 5,
          mood_1to5: 5,
          niggle_today: false,
        },
        { onConflict: 'user_id,checkin_date' },
      )
      .select('id, sleep_hours, energy_1to5')
      .single();

    expect(error).toBeNull();
    // Same row updated — ID should be the same
    expect(data!.id).toBe(createdCheckinIds[0]);
    expect(data!.sleep_hours).toBe(8);
    expect(data!.energy_1to5).toBe(5);
  });

  it('unique constraint prevents duplicate (user_id, checkin_date) via insert', async () => {
    const { error } = await svc
      .from('daily_checkins')
      .insert({
        user_id: testUserId,
        checkin_date: '2026-05-22',
        niggle_today: false,
      });

    expect(error).not.toBeNull();
    expect(error!.code).toBe('23505'); // unique_violation
  });
});
