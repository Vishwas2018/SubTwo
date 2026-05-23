// Unit tests for admin console pure logic.
// Refs: P3-09
import { describe, expect, it } from 'vitest';

// ── generateCode (replicated from API route) ──
function generateCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  return Array.from(
    { length: 8 },
    () => chars[Math.floor(Math.random() * chars.length)],
  ).join('');
}

describe('generateCode', () => {
  it('produces an 8-character string', () => {
    expect(generateCode()).toHaveLength(8);
  });

  it('only contains uppercase letters and digits', () => {
    for (let i = 0; i < 50; i++) {
      expect(generateCode()).toMatch(/^[A-Z0-9]{8}$/);
    }
  });

  it('produces different codes across calls', () => {
    const codes = Array.from({ length: 20 }, generateCode);
    const unique = new Set(codes);
    expect(unique.size).toBeGreaterThan(1);
  });
});

// ── invite status computation (replicated from GET handler) ──
function computeStatus(
  use_count: number,
  max_uses: number | null,
  expires_at: string | null,
): 'active' | 'used' | 'expired' {
  const now = new Date();
  const expired = expires_at != null && new Date(expires_at) <= now;
  const used = use_count >= (max_uses ?? 1);
  return used ? 'used' : expired ? 'expired' : 'active';
}

describe('invite status computation', () => {
  it('active when not used and not expired', () => {
    expect(computeStatus(0, 1, null)).toBe('active');
  });

  it('used when use_count >= max_uses', () => {
    expect(computeStatus(1, 1, null)).toBe('used');
    expect(computeStatus(5, 5, null)).toBe('used');
  });

  it('expired when expires_at is in the past and not used', () => {
    expect(computeStatus(0, 1, '2020-01-01T00:00:00Z')).toBe('expired');
  });

  it('used takes precedence over expired', () => {
    expect(computeStatus(1, 1, '2020-01-01T00:00:00Z')).toBe('used');
  });

  it('active when expires_at is in the future', () => {
    const future = new Date(Date.now() + 86_400_000).toISOString();
    expect(computeStatus(0, 1, future)).toBe('active');
  });
});

// ── SpendBar pct cap ──
function spendPct(spend: number, cap: number): number {
  return Math.min((spend / cap) * 100, 100);
}

describe('spendPct', () => {
  it('returns 0 for zero spend', () => expect(spendPct(0, 50)).toBe(0));
  it('returns 100 for spend equal to cap', () => expect(spendPct(50, 50)).toBe(100));
  it('caps at 100 when spend exceeds cap', () => expect(spendPct(120, 100)).toBe(100));
  it('returns proportional value', () => expect(spendPct(25, 100)).toBe(25));
});
