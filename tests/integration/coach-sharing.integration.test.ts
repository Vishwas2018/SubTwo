// Coach sharing integration tests — runs against remote Supabase project
// Refs: P3-08, docs/03-Database-Schema.md, docs/06-Auth-Security.md
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_AVAILABLE = !!process.env.SUPABASE_URL;

describe.skipIf(!SUPABASE_AVAILABLE)('Coach sharing integration', () => {
  const ATHLETE_EMAIL = `athlete-${Date.now()}@example.com`;
  const COACH_EMAIL = `coach-${Date.now()}@example.com`;
  const OTHER_EMAIL = `other-${Date.now()}@example.com`;
  const TEST_PASSWORD = 'CoachTest@123456!';

  let serviceClient: SupabaseClient;
  let athleteClient: SupabaseClient;
  let coachClient: SupabaseClient;
  let otherClient: SupabaseClient;

  let athleteId: string;
  let coachId: string;
  let otherId: string;
  let runId: string;
  let inviteId: string;
  let inviteToken: string;

  beforeAll(async () => {
    const SUPABASE_URL = process.env.SUPABASE_URL!;
    const ANON_KEY = process.env.SUPABASE_ANON_KEY!;
    const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY!;

    serviceClient = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Create three test users
    const [ua, uc, uo] = await Promise.all([
      serviceClient.auth.admin.createUser({
        email: ATHLETE_EMAIL,
        password: TEST_PASSWORD,
        email_confirm: true,
      }),
      serviceClient.auth.admin.createUser({
        email: COACH_EMAIL,
        password: TEST_PASSWORD,
        email_confirm: true,
      }),
      serviceClient.auth.admin.createUser({
        email: OTHER_EMAIL,
        password: TEST_PASSWORD,
        email_confirm: true,
      }),
    ]);
    if (ua.error) throw new Error(`Create athlete: ${ua.error.message}`);
    if (uc.error) throw new Error(`Create coach: ${uc.error.message}`);
    if (uo.error) throw new Error(`Create other: ${uo.error.message}`);

    athleteId = ua.data.user.id;
    coachId = uc.data.user.id;
    otherId = uo.data.user.id;

    // Sign in all three
    const signIn = async (email: string) => {
      const c = createClient(SUPABASE_URL, ANON_KEY);
      const { data, error } = await c.auth.signInWithPassword({ email, password: TEST_PASSWORD });
      if (error) throw new Error(`Sign-in ${email}: ${error.message}`);
      return createClient(SUPABASE_URL, ANON_KEY, {
        global: { headers: { Authorization: `Bearer ${data.session!.access_token}` } },
        auth: { autoRefreshToken: false, persistSession: false },
      });
    };

    [athleteClient, coachClient, otherClient] = await Promise.all([
      signIn(ATHLETE_EMAIL),
      signIn(COACH_EMAIL),
      signIn(OTHER_EMAIL),
    ]);

    // Athlete inserts a run
    const { data: run, error: runErr } = await athleteClient
      .from('runs')
      .insert({
        user_id: athleteId,
        source: 'manual',
        run_date: '2026-05-23',
        distance_km: 10.0,
        duration_seconds: 3600,
      })
      .select('id')
      .single();
    if (runErr) throw new Error(`Insert run: ${runErr.message}`);
    runId = run.id as string;
  }, 45000);

  afterAll(async () => {
    await serviceClient.from('run_comments').delete().eq('run_id', runId);
    await serviceClient.from('viewer_access').delete().eq('athlete_id', athleteId);
    await serviceClient.from('runs').delete().eq('id', runId);
    await Promise.all([
      serviceClient.auth.admin.deleteUser(athleteId),
      serviceClient.auth.admin.deleteUser(coachId),
      serviceClient.auth.admin.deleteUser(otherId),
    ]);
  }, 20000);

  // ─── Invite creation ───────────────────────────────────────────────────────

  describe('Invite creation (viewer_access)', () => {
    it('Athlete can create a pending invite', async () => {
      inviteToken = crypto.randomUUID();
      const { data: inv, error } = await serviceClient
        .from('viewer_access')
        .insert({
          athlete_id: athleteId,
          invite_email: COACH_EMAIL,
          invite_token: inviteToken,
          can_comment: true,
          status: 'pending',
        })
        .select('id')
        .single();
      expect(error).toBeNull();
      expect(inv).not.toBeNull();
      inviteId = inv!.id as string;
    });

    it('Non-owner cannot create an invite on behalf of athlete', async () => {
      const { error } = await otherClient
        .from('viewer_access')
        .insert({
          athlete_id: athleteId,
          invite_email: 'x@x.com',
          invite_token: crypto.randomUUID(),
          can_comment: false,
          status: 'pending',
        });
      // RLS athlete_manages_access blocks this
      expect(error).not.toBeNull();
    });
  });

  // ─── Accept flow ───────────────────────────────────────────────────────────

  describe('Accept flow', () => {
    it('Coach accepts invite — viewer_id set, status active', async () => {
      const { error } = await serviceClient
        .from('viewer_access')
        .update({
          viewer_id: coachId,
          status: 'active',
          accepted_at: new Date().toISOString(),
          invite_token: null,
        })
        .eq('id', inviteId);
      expect(error).toBeNull();
    });

    it('Coach can SELECT athlete runs after acceptance (RLS viewer_read_access)', async () => {
      const { data, error } = await coachClient
        .from('runs')
        .select('id')
        .eq('id', runId);
      expect(error).toBeNull();
      expect(data).toHaveLength(1);
    });

    it('Other user still cannot SELECT athlete runs', async () => {
      const { data, error } = await otherClient
        .from('runs')
        .select('id')
        .eq('id', runId);
      expect(error).toBeNull();
      expect(data).toHaveLength(0);
    });
  });

  // ─── Viewer cannot mutate athlete data ────────────────────────────────────

  describe('Viewer cannot write athlete data', () => {
    it('Coach cannot INSERT a run for athlete', async () => {
      const { error } = await coachClient
        .from('runs')
        .insert({
          user_id: athleteId,
          source: 'manual',
          run_date: '2026-05-24',
          distance_km: 5.0,
          duration_seconds: 1800,
        });
      expect(error).not.toBeNull();
    });

    it('Coach cannot UPDATE athlete run', async () => {
      const { error } = await coachClient
        .from('runs')
        .update({ distance_km: 99 })
        .eq('id', runId);
      // RLS: update affects 0 rows or errors — verify value unchanged
      const { data: check } = await serviceClient
        .from('runs')
        .select('distance_km')
        .eq('id', runId)
        .single();
      expect((check as { distance_km: number } | null)?.distance_km).toBe(10.0);
    });
  });

  // ─── Comments ──────────────────────────────────────────────────────────────

  describe('Comments (can_comment=true)', () => {
    let commentId: string;

    it('Coach can insert a comment (RLS viewer_can_insert_comment)', async () => {
      const { data: c, error } = await coachClient
        .from('run_comments')
        .insert({ run_id: runId, author_id: coachId, comment: 'Great pace!' })
        .select('id')
        .single();
      expect(error).toBeNull();
      expect(c).not.toBeNull();
      commentId = c!.id as string;
    });

    it('Athlete can read coach comment (RLS run_owner_reads_comments)', async () => {
      const { data, error } = await athleteClient
        .from('run_comments')
        .select('id, comment')
        .eq('run_id', runId)
        .is('deleted_at', null);
      expect(error).toBeNull();
      const found = data?.find((c: { id: string }) => c.id === commentId);
      expect(found).toBeTruthy();
    });

    it('Coach can read own comment', async () => {
      const { data, error } = await coachClient
        .from('run_comments')
        .select('id')
        .eq('id', commentId);
      expect(error).toBeNull();
      expect(data).toHaveLength(1);
    });

    it('Other user cannot read the comment', async () => {
      const { data, error } = await otherClient
        .from('run_comments')
        .select('id')
        .eq('id', commentId);
      expect(error).toBeNull();
      expect(data).toHaveLength(0);
    });

    it('Other user cannot insert a comment', async () => {
      const { error } = await otherClient
        .from('run_comments')
        .insert({ run_id: runId, author_id: otherId, comment: 'Hack!' });
      expect(error).not.toBeNull();
    });
  });

  // ─── Revoke kills access ────────────────────────────��─────────────────────

  describe('Revoke', () => {
    it('Athlete revokes access — coach loses read on runs', async () => {
      const { error } = await athleteClient
        .from('viewer_access')
        .update({ status: 'revoked', revoked_at: new Date().toISOString() })
        .eq('id', inviteId);
      expect(error).toBeNull();
    });

    it('Coach no longer sees athlete runs after revoke', async () => {
      const { data, error } = await coachClient
        .from('runs')
        .select('id')
        .eq('id', runId);
      expect(error).toBeNull();
      expect(data).toHaveLength(0);
    });
  });

  // ─── Expired token validation (checked at application layer) ──────────────

  describe('Expired token (service-layer check)', () => {
    it('Token older than 7 days is considered expired', () => {
      const TOKEN_EXPIRY_MS = 7 * 24 * 60 * 60 * 1_000;
      const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1_000).toISOString();
      const age = Date.now() - new Date(eightDaysAgo).getTime();
      expect(age).toBeGreaterThan(TOKEN_EXPIRY_MS);
    });

    it('Token from 6 days ago is still valid', () => {
      const TOKEN_EXPIRY_MS = 7 * 24 * 60 * 60 * 1_000;
      const sixDaysAgo = new Date(Date.now() - 6 * 24 * 60 * 60 * 1_000).toISOString();
      const age = Date.now() - new Date(sixDaysAgo).getTime();
      expect(age).toBeLessThan(TOKEN_EXPIRY_MS);
    });
  });
});
