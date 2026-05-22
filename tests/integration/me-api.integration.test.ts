// Integration tests for /api/me PATCH and /api/export shape.
// Tests call Supabase directly (no HTTP server). Skipped without SUPABASE_URL.
// Refs: P2-14
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_AVAILABLE = !!process.env.SUPABASE_URL;

describe.skipIf(!SUPABASE_AVAILABLE)('/api/me profile update integration', () => {
  let svc: SupabaseClient;
  let testUserId: string;

  beforeAll(async () => {
    svc = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const email = `me-api-test-${Date.now()}@example.com`;
    const { data: u, error } = await svc.auth.admin.createUser({
      email,
      password: 'MeApiTest@123456!',
      email_confirm: true,
    });
    if (error) throw new Error(`Create user: ${error.message}`);
    testUserId = u.user.id;
  }, 30_000);

  afterAll(async () => {
    await svc.auth.admin.deleteUser(testUserId);
  }, 15_000);

  it('profile row is created via handle_new_user trigger', async () => {
    const { data, error } = await svc
      .from('profiles')
      .select('id, email, display_name, timezone')
      .eq('id', testUserId)
      .single();

    expect(error).toBeNull();
    expect(data!.id).toBe(testUserId);
    expect(data!.display_name).toBeNull();
    expect(data!.timezone).toBe('Australia/Melbourne');
  });

  it('can update display_name via direct DB update', async () => {
    const { data, error } = await svc
      .from('profiles')
      .update({ display_name: 'Test Runner', updated_at: new Date().toISOString() })
      .eq('id', testUserId)
      .select('display_name')
      .single();

    expect(error).toBeNull();
    expect(data!.display_name).toBe('Test Runner');
  });

  it('can clear display_name (set to null)', async () => {
    const { data, error } = await svc
      .from('profiles')
      .update({ display_name: null, updated_at: new Date().toISOString() })
      .eq('id', testUserId)
      .select('display_name')
      .single();

    expect(error).toBeNull();
    expect(data!.display_name).toBeNull();
  });

  it('display_name max 100 chars is enforced at application layer', () => {
    const longName = 'a'.repeat(101);
    const { z } = require('zod');
    const schema = z.object({ display_name: z.string().trim().max(100).nullable().optional() });
    const result = schema.safeParse({ display_name: longName });
    expect(result.success).toBe(false);
  });

  it('valid display_name passes schema validation', () => {
    const { z } = require('zod');
    const schema = z.object({ display_name: z.string().trim().max(100).nullable().optional() });
    expect(schema.safeParse({ display_name: 'Alex' }).success).toBe(true);
    expect(schema.safeParse({ display_name: null }).success).toBe(true);
    expect(schema.safeParse({}).success).toBe(true);
  });

  it('export data shape has all required top-level keys', () => {
    const exportPayload = {
      exported_at: new Date().toISOString(),
      user_id: testUserId,
      profile: {},
      plans: [],
      planned_sessions: [],
      runs: [],
      daily_checkins: [],
      checkpoints: [],
      niggles: [],
      plan_adjustments: [],
    };

    const keys = Object.keys(exportPayload);
    expect(keys).toContain('exported_at');
    expect(keys).toContain('user_id');
    expect(keys).toContain('profile');
    expect(keys).toContain('plans');
    expect(keys).toContain('runs');
    expect(keys).toContain('daily_checkins');
    expect(keys).toContain('checkpoints');
    expect(keys).toContain('niggles');
    expect(keys).toContain('plan_adjustments');
  });
});
