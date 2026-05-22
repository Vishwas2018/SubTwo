// Integration tests for niggles API.
// Tests call Supabase directly (no HTTP server). Skipped in CI without SUPABASE_URL.
// Refs: P2-12
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_AVAILABLE = !!process.env.SUPABASE_URL;

describe.skipIf(!SUPABASE_AVAILABLE)('niggles integration', () => {
  let svc: SupabaseClient;
  let testUserId: string;
  const createdIds: string[] = [];

  beforeAll(async () => {
    svc = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const email = `niggles-test-${Date.now()}@example.com`;
    const { data: u, error } = await svc.auth.admin.createUser({
      email,
      password: 'NiggleTest@123456!',
      email_confirm: true,
    });
    if (error) throw new Error(`Failed to create test user: ${error.message}`);
    testUserId = u.user.id;
  }, 30_000);

  afterAll(async () => {
    if (createdIds.length > 0) {
      await svc.from('niggles').delete().in('id', createdIds);
    }
    await svc.auth.admin.deleteUser(testUserId);
  }, 15_000);

  it('inserts a niggle with required fields', async () => {
    const { data, error } = await svc
      .from('niggles')
      .insert({
        user_id: testUserId,
        body_part: 'knee',
        severity: 4,
        started_date: '2026-05-01',
      })
      .select('id, body_part, severity, started_date, resolved_date, notes')
      .single();

    expect(error).toBeNull();
    expect(data).not.toBeNull();
    expect(data!.body_part).toBe('knee');
    expect(data!.severity).toBe(4);
    expect(data!.started_date).toBe('2026-05-01');
    expect(data!.resolved_date).toBeNull();
    expect(data!.notes).toBeNull();
    createdIds.push(data!.id as string);
  });

  it('inserts a niggle with all optional fields', async () => {
    const { data, error } = await svc
      .from('niggles')
      .insert({
        user_id: testUserId,
        body_part: 'calf',
        severity: 7,
        started_date: '2026-05-10',
        notes: 'Tightness after long run, not sharp pain.',
      })
      .select('id, body_part, severity, notes')
      .single();

    expect(error).toBeNull();
    expect(data!.severity).toBe(7);
    expect(data!.notes).toBe('Tightness after long run, not sharp pain.');
    createdIds.push(data!.id as string);
  });

  it('active filter returns only unresolved niggles', async () => {
    // Add a resolved niggle
    const { data: resolved } = await svc
      .from('niggles')
      .insert({
        user_id: testUserId,
        body_part: 'shin',
        severity: 2,
        started_date: '2026-04-01',
        resolved_date: '2026-04-10',
      })
      .select('id')
      .single();
    createdIds.push(resolved!.id as string);

    // Query active only
    const { data: active } = await svc
      .from('niggles')
      .select('id, body_part')
      .eq('user_id', testUserId)
      .is('resolved_date', null);

    const parts = (active ?? []).map((n) => n.body_part);
    expect(parts).toContain('knee');
    expect(parts).toContain('calf');
    expect(parts).not.toContain('shin');
  });

  it('updates severity via PATCH-equivalent update', async () => {
    const kneeId = createdIds[0];
    expect(kneeId).toBeTruthy();

    const { data, error } = await svc
      .from('niggles')
      .update({ severity: 6 })
      .eq('id', kneeId!)
      .eq('user_id', testUserId)
      .select('id, severity')
      .single();

    expect(error).toBeNull();
    expect(data!.severity).toBe(6);
  });

  it('resolves a niggle by setting resolved_date', async () => {
    const kneeId = createdIds[0];
    expect(kneeId).toBeTruthy();

    const resolvedDate = '2026-05-22';
    const { data, error } = await svc
      .from('niggles')
      .update({ resolved_date: resolvedDate })
      .eq('id', kneeId!)
      .eq('user_id', testUserId)
      .select('id, resolved_date')
      .single();

    expect(error).toBeNull();
    expect(data!.resolved_date).toBe(resolvedDate);
  });

  it('resolved niggle no longer appears in active filter', async () => {
    const { data: active } = await svc
      .from('niggles')
      .select('id')
      .eq('user_id', testUserId)
      .is('resolved_date', null);

    const ids = (active ?? []).map((n) => n.id);
    expect(ids).not.toContain(createdIds[0]);
  });

  it('all filter returns both active and resolved niggles', async () => {
    const { data: all } = await svc
      .from('niggles')
      .select('id, resolved_date')
      .eq('user_id', testUserId);

    const hasResolved = (all ?? []).some((n) => n.resolved_date !== null);
    const hasActive = (all ?? []).some((n) => n.resolved_date === null);
    expect(hasResolved).toBe(true);
    expect(hasActive).toBe(true);
  });

  it('severity must be between 1 and 10 (check constraint)', async () => {
    const { error } = await svc.from('niggles').insert({
      user_id: testUserId,
      body_part: 'hip',
      severity: 11,
      started_date: '2026-05-01',
    });
    // Postgres check constraint violation
    expect(error).not.toBeNull();
  });
});
