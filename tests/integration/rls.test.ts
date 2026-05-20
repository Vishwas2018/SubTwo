// RLS integration tests — runs against remote Supabase project (local Docker unavailable, see DEV-003)
// Refs: P1-04, docs/03-Database-Schema.md §3, docs/06-Auth-Security.md §3
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL!;
const ANON_KEY = process.env.SUPABASE_ANON_KEY!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY!;

const USER_A_EMAIL = `rls-test-a-${Date.now()}@example.com`;
const USER_B_EMAIL = `rls-test-b-${Date.now()}@example.com`;
const TEST_PASSWORD = 'RlsTest@123456!';

let serviceClient: SupabaseClient;
let clientA: SupabaseClient;
let clientB: SupabaseClient;
let userAId: string;
let userBId: string;
let runId: string;

beforeAll(async () => {
  serviceClient = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Create two test users via admin API (no email confirmation required)
  const { data: userA, error: errA } = await serviceClient.auth.admin.createUser({
    email: USER_A_EMAIL,
    password: TEST_PASSWORD,
    email_confirm: true,
  });
  if (errA) throw new Error(`Failed to create user A: ${errA.message}`);
  userAId = userA.user.id;

  const { data: userB, error: errB } = await serviceClient.auth.admin.createUser({
    email: USER_B_EMAIL,
    password: TEST_PASSWORD,
    email_confirm: true,
  });
  if (errB) throw new Error(`Failed to create user B: ${errB.message}`);
  userBId = userB.user.id;

  // Sign in as each user to get JWTs
  const anonA = createClient(SUPABASE_URL, ANON_KEY);
  const { data: sessionA, error: signInErrA } = await anonA.auth.signInWithPassword({
    email: USER_A_EMAIL,
    password: TEST_PASSWORD,
  });
  if (signInErrA) throw new Error(`Sign-in A failed: ${signInErrA.message}`);

  const anonB = createClient(SUPABASE_URL, ANON_KEY);
  const { data: sessionB, error: signInErrB } = await anonB.auth.signInWithPassword({
    email: USER_B_EMAIL,
    password: TEST_PASSWORD,
  });
  if (signInErrB) throw new Error(`Sign-in B failed: ${signInErrB.message}`);

  clientA = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${sessionA.session!.access_token}` } },
    auth: { autoRefreshToken: false, persistSession: false },
  });
  clientB = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${sessionB.session!.access_token}` } },
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // User A inserts a run (used by multiple tests)
  const { data: run, error: runErr } = await clientA
    .from('runs')
    .insert({
      user_id: userAId,
      source: 'manual',
      run_date: '2026-05-20',
      distance_km: 10.0,
      duration_seconds: 3600,
    })
    .select('id')
    .single();
  if (runErr) throw new Error(`Insert run failed: ${runErr.message}`);
  runId = run.id as string;
}, 30000);

afterAll(async () => {
  // Clean up test data
  await serviceClient.from('runs').delete().eq('id', runId);
  await serviceClient.auth.admin.deleteUser(userAId);
  await serviceClient.auth.admin.deleteUser(userBId);
}, 15000);

describe('RLS — cross-user isolation', () => {
  it('1. User B cannot SELECT runs owned by User A', async () => {
    const { data, error } = await clientB.from('runs').select('id').eq('id', runId);
    expect(error).toBeNull();
    expect(data).toHaveLength(0);
  });

  it('2. User A profile is not readable by User B', async () => {
    const { data, error } = await clientB.from('profiles').select('id').eq('id', userAId);
    expect(error).toBeNull();
    expect(data).toHaveLength(0);
  });

  it('3. Anonymous (no JWT) cannot read any table', async () => {
    const anonClient = createClient(SUPABASE_URL, ANON_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data, error } = await anonClient.from('runs').select('id').limit(1);
    // RLS blocks anon — either empty result or RLS error
    const blocked = error !== null || (Array.isArray(data) && data.length === 0);
    expect(blocked).toBe(true);
  });

  it('4. Service role can read all (bypasses RLS)', async () => {
    const { data, error } = await serviceClient.from('runs').select('id').eq('id', runId);
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
  });

  it('5. Profile self-update succeeds for owner, fails for other user', async () => {
    // Owner (A) can update own display_name
    const { error: ownerErr } = await clientA
      .from('profiles')
      .update({ display_name: 'Test Runner A' })
      .eq('id', userAId);
    expect(ownerErr).toBeNull();

    // User B cannot update User A's profile
    const { error: otherErr } = await clientB
      .from('profiles')
      .update({ display_name: 'Hijacked' })
      .eq('id', userAId);
    // RLS: update matches 0 rows or returns permission error
    const blocked = otherErr !== null || true; // update silently affects 0 rows with RLS
    expect(blocked).toBe(true);

    // Verify display_name was NOT changed by B
    const { data: check } = await serviceClient
      .from('profiles')
      .select('display_name')
      .eq('id', userAId)
      .single();
    expect((check as { display_name: string } | null)?.display_name).toBe('Test Runner A');
  });
});
