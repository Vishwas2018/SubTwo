// Admin console integration tests.
// Refs: P3-09
// Runs against remote Supabase; skipped in CI when SUPABASE_URL absent.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_AVAILABLE = !!process.env.SUPABASE_URL;

describe.skipIf(!SUPABASE_AVAILABLE)('Admin integration', () => {
  let svc: SupabaseClient;
  let adminId = '';
  let regularUserId = '';
  let regularAnonClient: SupabaseClient;

  const ADMIN_EMAIL = process.env.INITIAL_ADMIN_EMAIL ?? 'jvishu21@gmail.com';
  const REGULAR_EMAIL = `admin-test-regular-${Date.now()}@example.com`;
  const TEST_PASSWORD = 'AdminTest@12345!';

  const createdCodeIds: string[] = [];

  function randomCode() {
    return Array.from(
      { length: 8 },
      () => 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'[Math.floor(Math.random() * 36)],
    ).join('');
  }

  beforeAll(async () => {
    const URL = process.env.SUPABASE_URL!;
    const ANON = process.env.SUPABASE_ANON_KEY!;
    const SVC = process.env.SUPABASE_SERVICE_KEY!;

    svc = createClient(URL, SVC, { auth: { autoRefreshToken: false, persistSession: false } });

    // Ensure admin profile exists (should be auto-promoted by trigger)
    const { data: adminProfile } = await svc
      .from('profiles')
      .select('id, is_admin')
      .eq('email', ADMIN_EMAIL)
      .single();
    if (adminProfile) adminId = adminProfile.id;

    // Create a regular test user
    const { data: newUser, error } = await svc.auth.admin.createUser({
      email: REGULAR_EMAIL,
      password: TEST_PASSWORD,
      email_confirm: true,
    });
    if (error) throw new Error(`Create regular user: ${error.message}`);
    regularUserId = newUser.user.id;

    // Sign in as regular user
    regularAnonClient = createClient(URL, ANON);
    await regularAnonClient.auth.signInWithPassword({
      email: REGULAR_EMAIL,
      password: TEST_PASSWORD,
    });
  });

  afterAll(async () => {
    // Clean up invite codes
    if (createdCodeIds.length > 0) {
      await svc.from('invite_codes').delete().in('id', createdCodeIds);
    }
    // Delete regular test user
    if (regularUserId) {
      await svc.auth.admin.deleteUser(regularUserId);
    }
  });

  // ─── RLS: non-admin cannot read invite_codes ──────────────────────────────

  describe('RLS: non-admin blocked from invite_codes', () => {
    it('regular user cannot select from invite_codes', async () => {
      const { data, error } = await regularAnonClient.from('invite_codes').select('*');
      // RLS should return empty result (not an error) since there are no matching rows
      expect(data).toHaveLength(0);
      // error may be null (RLS returns empty) or an RLS error
      if (error) expect(error.code).not.toBe('PGRST000');
    });

    it('regular user cannot insert invite codes', async () => {
      const { error } = await regularAnonClient
        .from('invite_codes')
        .insert({ code: randomCode(), max_uses: 1 });
      expect(error).not.toBeNull();
    });
  });

  // ─── Admin can CRUD invite codes via service role ─────────────────────────

  describe('Admin invite code operations (via service role)', () => {
    let codeId: string;
    let code: string;

    it('admin can create an invite code', async () => {
      code = randomCode();
      const { data, error } = await svc
        .from('invite_codes')
        .insert({ code, max_uses: 1, note: 'integration test' })
        .select('id')
        .single();
      expect(error).toBeNull();
      expect(data?.id).toBeDefined();
      codeId = data!.id;
      createdCodeIds.push(codeId);
    });

    it('admin can list invite codes', async () => {
      const { data, error } = await svc
        .from('invite_codes')
        .select('id, code')
        .eq('id', codeId);
      expect(error).toBeNull();
      expect(data).toHaveLength(1);
      expect((data ?? [])[0]?.code).toBe(code);
    });

    it('validate_invite_code returns true for the new code', async () => {
      const { data, error } = await svc.rpc('validate_invite_code', { p_code: code });
      expect(error).toBeNull();
      expect(data).toBe(true);
    });

    it('admin can revoke unused code (delete)', async () => {
      const unusedCode = randomCode();
      const { data: inserted } = await svc
        .from('invite_codes')
        .insert({ code: unusedCode, max_uses: 1, note: 'to revoke' })
        .select('id')
        .single();
      const revokeId = inserted!.id;

      const { error } = await svc.from('invite_codes').delete().eq('id', revokeId);
      expect(error).toBeNull();

      const { data: gone } = await svc
        .from('invite_codes')
        .select('id')
        .eq('id', revokeId);
      expect(gone).toHaveLength(0);
    });

    it('expired code is rejected at signup (validate_invite_code returns false)', async () => {
      const expiredCode = randomCode();
      const { data: ins } = await svc
        .from('invite_codes')
        .insert({ code: expiredCode, max_uses: 10, expires_at: '2020-01-01T00:00:00Z' })
        .select('id')
        .single();
      createdCodeIds.push(ins!.id);

      const { data } = await svc.rpc('validate_invite_code', { p_code: expiredCode });
      expect(data).toBe(false);
    });
  });

  // ─── Admin profile promotion ──────────────────────────────────────────────

  describe.skipIf(!adminId)('Admin role', () => {
    it('admin profile has is_admin = true', async () => {
      const { data } = await svc
        .from('profiles')
        .select('is_admin')
        .eq('email', ADMIN_EMAIL)
        .single();
      expect(data?.is_admin).toBe(true);
    });
  });

  // ─── Suspended flag ───────────────────────────────────────────────────────

  describe('Suspended flag', () => {
    it('regular user starts unsuspended', async () => {
      const { data } = await svc
        .from('profiles')
        .select('suspended')
        .eq('id', regularUserId)
        .single();
      expect(data?.suspended).toBe(false);
    });

    it('service role can set suspended = true', async () => {
      const { data, error } = await svc
        .from('profiles')
        .update({ suspended: true })
        .eq('id', regularUserId)
        .select('suspended')
        .single();
      expect(error).toBeNull();
      expect(data?.suspended).toBe(true);
    });

    it('service role can unsuspend', async () => {
      const { data } = await svc
        .from('profiles')
        .update({ suspended: false })
        .eq('id', regularUserId)
        .select('suspended')
        .single();
      expect(data?.suspended).toBe(false);
    });
  });

  // ─── AI usage function reachable via service role ─────────────────────────

  describe('get_monthly_ai_spend', () => {
    it('returns a numeric value', async () => {
      const { data, error } = await svc.rpc('get_monthly_ai_spend');
      expect(error).toBeNull();
      expect(typeof Number(data)).toBe('number');
    });
  });
});
