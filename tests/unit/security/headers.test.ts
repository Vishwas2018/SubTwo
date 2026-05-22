// Unit tests for security headers (DEF-012).
// Imports next.config.ts headers() and validates all required headers are present.
// Refs: DEF-012
import { describe, it, expect } from 'vitest';
import nextConfig from '@/next.config';
import type { NextConfig } from 'next';

type HeaderEntry = { key: string; value: string };
type RouteHeaders = { source: string; headers: HeaderEntry[] };

async function getHeaders(): Promise<HeaderEntry[]> {
  const cfg = nextConfig as NextConfig & {
    headers?: () => Promise<RouteHeaders[]>;
  };
  if (!cfg.headers) return [];
  const routes = await cfg.headers();
  // Return headers for the catch-all route '/(.*)'
  return routes.find((r) => r.source === '/(.*)') ?.headers ?? [];
}

describe('security headers (DEF-012)', () => {
  it('Content-Security-Policy header is set', async () => {
    const headers = await getHeaders();
    const csp = headers.find((h) => h.key === 'Content-Security-Policy');
    expect(csp).toBeDefined();
    expect(csp!.value).toContain("default-src 'self'");
    expect(csp!.value).toContain("frame-ancestors 'none'");
    expect(csp!.value).toContain("object-src 'none'");
    expect(csp!.value).toContain('upgrade-insecure-requests');
  });

  it('CSP connect-src includes Supabase domains', async () => {
    const headers = await getHeaders();
    const csp = headers.find((h) => h.key === 'Content-Security-Policy');
    expect(csp!.value).toContain('supabase.co');
  });

  it('Strict-Transport-Security is set with 1 year + includeSubDomains', async () => {
    const headers = await getHeaders();
    const hsts = headers.find((h) => h.key === 'Strict-Transport-Security');
    expect(hsts).toBeDefined();
    expect(hsts!.value).toContain('max-age=31536000');
    expect(hsts!.value).toContain('includeSubDomains');
  });

  it('X-Content-Type-Options is nosniff', async () => {
    const headers = await getHeaders();
    const xct = headers.find((h) => h.key === 'X-Content-Type-Options');
    expect(xct?.value).toBe('nosniff');
  });

  it('X-Frame-Options is DENY', async () => {
    const headers = await getHeaders();
    const xfo = headers.find((h) => h.key === 'X-Frame-Options');
    expect(xfo?.value).toBe('DENY');
  });

  it('Referrer-Policy is strict-origin-when-cross-origin', async () => {
    const headers = await getHeaders();
    const rp = headers.find((h) => h.key === 'Referrer-Policy');
    expect(rp?.value).toBe('strict-origin-when-cross-origin');
  });

  it('Permissions-Policy restricts camera, microphone, geolocation', async () => {
    const headers = await getHeaders();
    const pp = headers.find((h) => h.key === 'Permissions-Policy');
    expect(pp).toBeDefined();
    expect(pp!.value).toContain('camera=()');
    expect(pp!.value).toContain('microphone=()');
    expect(pp!.value).toContain('geolocation=()');
  });

  it('all 6 required security headers are present', async () => {
    const headers = await getHeaders();
    const keys = headers.map((h) => h.key);
    expect(keys).toContain('Content-Security-Policy');
    expect(keys).toContain('Strict-Transport-Security');
    expect(keys).toContain('X-Content-Type-Options');
    expect(keys).toContain('X-Frame-Options');
    expect(keys).toContain('Referrer-Policy');
    expect(keys).toContain('Permissions-Policy');
  });
});
