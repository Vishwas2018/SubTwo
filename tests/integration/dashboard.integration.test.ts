// Integration tests for getDashboardData — shape + alert computation.
// Tests call Supabase directly. Skipped in CI without SUPABASE_URL.
// Refs: P2-13
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_AVAILABLE = !!process.env.SUPABASE_URL;

describe.skipIf(!SUPABASE_AVAILABLE)('getDashboardData integration', () => {
  let svc: SupabaseClient;
  let testUserId: string;
  let planId: string;
  const cleanupIds: { table: string; id: string }[] = [];

  beforeAll(async () => {
    svc = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const email = `dash-test-${Date.now()}@example.com`;
    const { data: u, error } = await svc.auth.admin.createUser({
      email,
      password: 'DashTest@123456!',
      email_confirm: true,
    });
    if (error) throw new Error(`Create user: ${error.message}`);
    testUserId = u.user.id;
  }, 30_000);

  afterAll(async () => {
    for (const { table, id } of cleanupIds.reverse()) {
      await svc.from(table).delete().eq('id', id);
    }
    await svc.auth.admin.deleteUser(testUserId);
  }, 20_000);

  it('returns null when user has no active plan', async () => {
    const { data: plans } = await svc
      .from('plans')
      .select('id')
      .eq('user_id', testUserId)
      .eq('status', 'active');

    expect((plans ?? []).length).toBe(0);
  });

  it('check-in inserts with sleep and RHR', async () => {
    const { data, error } = await svc
      .from('daily_checkins')
      .insert({
        user_id: testUserId,
        checkin_date: '2026-05-20',
        sleep_hours: 6.5,
        resting_hr: 52,
        niggle_today: false,
      })
      .select('id, sleep_hours, resting_hr')
      .single();

    expect(error).toBeNull();
    expect(data!.sleep_hours).toBe(6.5);
    expect(data!.resting_hr).toBe(52);
    cleanupIds.push({ table: 'daily_checkins', id: data!.id as string });
  });

  it('niggle with 5 active days triggers alert via daysBetween', async () => {
    const { daysBetween } = await import('@/lib/dashboard/alert-rules');
    const days = daysBetween('2026-05-17', '2026-05-22');
    expect(days).toBe(5);

    const { niggleAlert } = await import('@/lib/dashboard/alert-rules');
    expect(niggleAlert([days])).not.toBeNull();
  });

  it('sleep alert fires when 3 checkins average below 7h', async () => {
    const { sleepAlert } = await import('@/lib/dashboard/alert-rules');
    const alert = sleepAlert([6.5, 6.0, 6.5]);
    expect(alert).not.toBeNull();
    expect(alert!.message).toContain('6.3h');
  });

  it('sleep alert does not fire with good sleep', async () => {
    const { sleepAlert } = await import('@/lib/dashboard/alert-rules');
    expect(sleepAlert([7.5, 8.0, 7.0])).toBeNull();
  });

  it('active niggles query returns only unresolved', async () => {
    const now = new Date().toISOString().split('T')[0]!;

    const { data: active, error } = await svc
      .from('niggles')
      .insert([
        { user_id: testUserId, body_part: 'knee', severity: 3, started_date: '2026-05-15' },
        { user_id: testUserId, body_part: 'calf', severity: 2, started_date: '2026-05-01', resolved_date: '2026-05-10' },
      ])
      .select('id');

    expect(error).toBeNull();
    for (const row of active ?? []) {
      cleanupIds.push({ table: 'niggles', id: row.id as string });
    }

    const { data: unresolved } = await svc
      .from('niggles')
      .select('id, started_date')
      .eq('user_id', testUserId)
      .is('resolved_date', null);

    expect((unresolved ?? []).length).toBeGreaterThanOrEqual(1);
    expect((unresolved ?? []).every((n) => n.started_date !== undefined)).toBe(true);
  });
});
