// Unit tests for password+invite schema validation (beta auth path)
// No Supabase connection required — schema only.

import { describe, expect, it } from 'vitest';
import { z } from 'zod';

const SignupSchema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  invite_code: z.string().regex(/^[A-Z0-9]{8}$/, 'Invalid code format'),
});

// ─── Password validation ───────────────────────────────────────────────────────

describe('password validation', () => {
  it('accepts a valid password (≥ 8 chars)', () => {
    const r = SignupSchema.safeParse({ email: 'a@b.com', password: 'correct-horse', invite_code: 'ABCD1234' });
    expect(r.success).toBe(true);
  });

  it('rejects password shorter than 8 chars', () => {
    const r = SignupSchema.safeParse({ email: 'a@b.com', password: 'short', invite_code: 'ABCD1234' });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0]?.message).toMatch(/at least 8/i);
  });

  it('rejects empty password', () => {
    const r = SignupSchema.safeParse({ email: 'a@b.com', password: '', invite_code: 'ABCD1234' });
    expect(r.success).toBe(false);
  });

  it('accepts exactly 8-char password', () => {
    const r = SignupSchema.safeParse({ email: 'a@b.com', password: '12345678', invite_code: 'ABCD1234' });
    expect(r.success).toBe(true);
  });

  it('accepts long password', () => {
    const r = SignupSchema.safeParse({ email: 'a@b.com', password: 'x'.repeat(64), invite_code: 'ABCD1234' });
    expect(r.success).toBe(true);
  });
});

// ─── Password + invite code combined ──────────────────────────────────────────

describe('password + invite_code combined', () => {
  it('rejects when both password and invite_code are invalid', () => {
    const r = SignupSchema.safeParse({ email: 'a@b.com', password: 'short', invite_code: 'bad' });
    expect(r.success).toBe(false);
    expect(r.error?.issues.length).toBeGreaterThanOrEqual(2);
  });

  it('rejects invalid invite_code with valid password', () => {
    const r = SignupSchema.safeParse({ email: 'a@b.com', password: 'validpass', invite_code: 'abc12345' });
    expect(r.success).toBe(false);
    const paths = r.error?.issues.map((i) => i.path[0]);
    expect(paths).toContain('invite_code');
  });

  it('rejects invalid password with valid invite_code', () => {
    const r = SignupSchema.safeParse({ email: 'a@b.com', password: 'weak', invite_code: 'ABCD1234' });
    expect(r.success).toBe(false);
    const paths = r.error?.issues.map((i) => i.path[0]);
    expect(paths).toContain('password');
  });

  it('accepts valid email + password + invite_code', () => {
    const r = SignupSchema.safeParse({ email: 'tester@subtwo.app', password: 'BetaPass1', invite_code: 'XYZABC99' });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.email).toBe('tester@subtwo.app');
      expect(r.data.password).toBe('BetaPass1');
      expect(r.data.invite_code).toBe('XYZABC99');
    }
  });
});
