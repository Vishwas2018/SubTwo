// Unit tests for F-01 open redirect fix in app/auth/callback/route.ts
// Tests the safeRedirectPath helper extracted from the route.
import { describe, expect, it } from 'vitest';

function safeRedirectPath(next: string | null): string {
  if (
    !next ||
    !next.startsWith('/') ||
    next.startsWith('//') ||
    next.includes('://')
  ) {
    return '/dashboard';
  }
  return next;
}

describe('safeRedirectPath (F-01 open redirect guard)', () => {
  it('passes a simple relative path', () => {
    expect(safeRedirectPath('/dashboard')).toBe('/dashboard');
  });

  it('passes a nested relative path', () => {
    expect(safeRedirectPath('/plan/123')).toBe('/plan/123');
  });

  it('passes /check-in', () => {
    expect(safeRedirectPath('/check-in')).toBe('/check-in');
  });

  it('rejects https:// external URL → /dashboard', () => {
    expect(safeRedirectPath('https://evil.com')).toBe('/dashboard');
  });

  it('rejects http:// external URL → /dashboard', () => {
    expect(safeRedirectPath('http://evil.com')).toBe('/dashboard');
  });

  it('rejects protocol-relative //evil.com → /dashboard', () => {
    expect(safeRedirectPath('//evil.com')).toBe('/dashboard');
  });

  it('rejects //evil.com/path → /dashboard', () => {
    expect(safeRedirectPath('//evil.com/path')).toBe('/dashboard');
  });

  it('rejects null → /dashboard', () => {
    expect(safeRedirectPath(null)).toBe('/dashboard');
  });

  it('rejects empty string → /dashboard', () => {
    expect(safeRedirectPath('')).toBe('/dashboard');
  });

  it('rejects path not starting with / → /dashboard', () => {
    expect(safeRedirectPath('evil.com/path')).toBe('/dashboard');
  });

  it('rejects javascript: scheme → /dashboard', () => {
    expect(safeRedirectPath('javascript:alert(1)')).toBe('/dashboard');
  });
});
