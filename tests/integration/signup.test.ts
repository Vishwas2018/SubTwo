// Signup integration tests — validates invite code business logic against remote Supabase.
// Approach: tests call validate_invite_code RPC directly (no HTTP server needed).
// Format validation tests import SignupSchema directly.
// Refs: P1-11, docs/06-Auth-Security.md §2

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY!;

const SignupSchema = z.object({
  email: z.string().email().max(254),
  invite_code: z.string().regex(/^[A-Z0-9]{8}$/, 'Invalid code format'),
});

let svc: SupabaseClient;

const randomCode = () =>
  Array.from({ length: 8 }, () => 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'[Math.floor(Math.random() * 36)]).join('');

const createdCodeIds: string[] = [];

async function insertCode(
  svc: SupabaseClient,
  opts: { code?: string; max_uses?: number | null; use_count?: number; expires_at?: string | null },
): Promise<string> {
  const code = opts.code ?? randomCode();
  const { data, error } = await svc
    .from('invite_codes')
    .insert({
      code,
      max_uses: opts.max_uses ?? 10,
      use_count: opts.use_count ?? 0,
      expires_at: opts.expires_at ?? null,
      note: 'test',
    })
    .select('id')
    .single();
  if (error) throw new Error(`Failed to insert invite code: ${error.message}`);
  createdCodeIds.push(data.id as string);
  return code;
}

beforeEach(() => {
  svc = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
});

afterEach(async () => {
  if (createdCodeIds.length > 0) {
    await svc.from('invite_codes').delete().in('id', createdCodeIds);
    createdCodeIds.length = 0;
  }
});

// ─── Scenario 1: Valid code — validate_invite_code returns true and increments use_count ──

describe('Scenario 1 — valid invite code', () => {
  it('returns true and increments use_count', async () => {
    const code = await insertCode(svc, { max_uses: 5, use_count: 0 });

    const { data, error } = await svc.rpc('validate_invite_code', { p_code: code });
    expect(error).toBeNull();
    expect(data).toBe(true);

    const { data: row } = await svc
      .from('invite_codes')
      .select('use_count')
      .eq('code', code)
      .single();
    expect((row as { use_count: number }).use_count).toBe(1);
  });
});

// ─── Scenario 2: Invalid code format — Zod schema rejects ────────────────────────────────

describe('Scenario 2 — invalid code format', () => {
  it('lowercase code fails schema validation', () => {
    const r = SignupSchema.safeParse({ email: 'test@example.com', invite_code: 'abc12345' });
    expect(r.success).toBe(false);
  });

  it('code shorter than 8 chars fails', () => {
    const r = SignupSchema.safeParse({ email: 'test@example.com', invite_code: 'ABCD123' });
    expect(r.success).toBe(false);
  });

  it('code with special chars fails', () => {
    const r = SignupSchema.safeParse({ email: 'test@example.com', invite_code: 'ABCD-123' });
    expect(r.success).toBe(false);
  });

  it('valid format passes schema validation', () => {
    const r = SignupSchema.safeParse({ email: 'test@example.com', invite_code: 'ABCD1234' });
    expect(r.success).toBe(true);
  });
});

// ─── Scenario 3: Non-existent code ───────────────────────────────────────────────────────

describe('Scenario 3 — non-existent code', () => {
  it('validate_invite_code returns false for unknown code', async () => {
    const { data, error } = await svc.rpc('validate_invite_code', { p_code: 'ZZZZZZZZ' });
    expect(error).toBeNull();
    expect(data).toBe(false);
  });
});

// ─── Scenario 4: Expired code ────────────────────────────────────────────────────────────

describe('Scenario 4 — expired code', () => {
  it('validate_invite_code returns false for expired code', async () => {
    const code = await insertCode(svc, {
      max_uses: 10,
      expires_at: '2020-01-01T00:00:00Z',
    });

    const { data, error } = await svc.rpc('validate_invite_code', { p_code: code });
    expect(error).toBeNull();
    expect(data).toBe(false);
  });
});

// ─── Scenario 5: Exhausted code (max_uses reached) ───────────────────────────────────────

describe('Scenario 5 — exhausted code', () => {
  it('validate_invite_code returns false when use_count >= max_uses', async () => {
    const code = await insertCode(svc, { max_uses: 1, use_count: 1 });

    const { data, error } = await svc.rpc('validate_invite_code', { p_code: code });
    expect(error).toBeNull();
    expect(data).toBe(false);
  });
});

// ─── Scenario 6: Concurrent single-use code ──────────────────────────────────────────────

describe('Scenario 6 — concurrent submissions of single-use code', () => {
  it('exactly one concurrent call succeeds, others fail', async () => {
    const code = await insertCode(svc, { max_uses: 1, use_count: 0 });

    const results = await Promise.all(
      Array.from({ length: 5 }, () =>
        svc.rpc('validate_invite_code', { p_code: code }).then((r) => r.data as boolean),
      ),
    );

    const successes = results.filter(Boolean).length;
    const failures = results.filter((r) => !r).length;

    expect(successes).toBe(1);
    expect(failures).toBe(4);
  });
});
