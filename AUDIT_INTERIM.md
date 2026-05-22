# AUDIT_INTERIM.md — Phase 1-2 Interim Audit
**Date:** 2026-05-22  
**Auditor:** Claude Code (claude-sonnet-4-6) — CCTV automated protocol  
**Scope:** Phase 1-2 built features only — auth, wizard, plan generation, /plan, /session  
**Environment:** Windows 11, Node 20, pnpm, Next.js 16.2.6 (Turbopack)

---

## Summary

### What's Healthy
- **TypeScript:** 0 errors (`pnpm typecheck` clean)
- **ESLint:** 0 warnings or errors (`pnpm lint` clean)
- **Unit tests:** 17 files, 409 tests — all pass
- **Integration tests:** 5/6 files pass (28/29 tests pass); 1 known failure (ai-live timeout, excluded per brief)
- **Build:** Clean — 17 routes compiled, no bundle warnings
- **Code quality:** Zero `as any` / `: any` / `@ts-ignore` / TODO/FIXME / empty catch blocks / console.log in app or lib code
- **Secrets:** No hardcoded `sk-ant-` keys or service-role key values in tracked source files
- **gitignore:** `.env.local` and `.env.test` both gitignored ✅
- **Auth guards:** All protected routes redirect unauthenticated users (307) — confirmed by HTTP smoke test
- **RLS:** All 15 tables covered in migration 016 (audit_log intentionally zero-policy = deny all)
- **API validation:** All API routes that accept input use Zod; error shape `{ error: { code, message } }` is consistent
- **Invite-code gate:** Bad invite code returns correct error (`invalid_invite`) with appropriate user-facing message ✅
- **Email enumeration protection:** Login endpoint returns success regardless of whether email exists ✅

### What Needs Attention
- **P1:** Open redirect in `/auth/callback` — magic link phishing vector
- **P2:** `/api/auth/login` has no rate limiting — magic link spam/abuse
- **P2:** `ai_generation_count` update is non-atomic — can drift under concurrent requests
- **P2:** In-memory rate limiter is process-local — not effective in multi-worker production
- **P2:** No error boundaries on any page — unhandled errors show Next.js default UI
- **P3:** `distanceLabel()` helper duplicated across 3 files
- **P3:** Hardcoded real-looking email in dev session route
- **P3:** `UntypedRpc` cast in activate/regenerate routes — bypasses DB type safety
- **P3:** `proxy.ts` middleware naming — non-standard, verify this is Next.js 16 convention

---

## Findings Table

| ID | Severity | Area | File / Route | Issue | Recommendation |
|----|----------|------|-------------|-------|----------------|
| F-01 | **P1** | Security | `app/auth/callback/route.ts:8-12` | Open redirect: `new URL(searchParams.get('next'), origin)` does not validate that `next` is a same-origin path. A crafted magic link with `?next=https://attacker.com` redirects the user externally after auth, leaking the session. | Validate `next` is a relative path before using it: `const safePath = next?.startsWith('/') && !next.startsWith('//') ? next : '/dashboard'` |
| F-02 | **P2** | Security | `app/api/auth/login/route.ts` | No rate limiting on magic-link send endpoint. An attacker can spam any email with magic links (email abuse, cost amplification). Contrast with signup which has 5 req/hr/IP limit. | Add `checkLimit()` call matching the signup route pattern. |
| F-03 | **P2** | Correctness | `app/api/plans/generate/route.ts:157-159`, `app/api/plans/[id]/regenerate/route.ts:171-175` | `ai_generation_count` update is a non-atomic read-modify-write: reads `quotaResult.lifetime_used` then sets to `lifetime_used + 1`. Concurrent requests for the same user can both read the same baseline and set the same value, causing count to drift. | Use a DB `INCREMENT` RPC or Supabase `.rpc('increment_generation_count', { p_user_id })` instead of manual +1. |
| F-04 | **P2** | Ops/Infra | `lib/rate-limit/memory.ts` | Rate limiter uses a `Map` in the Node.js process heap. In a multi-worker production environment (Vercel Serverless/Edge), each worker instance has its own counter. Effective per-IP limit is `max * num_active_workers`, not `max`. | Replace with Redis/Upstash rate limit for production, or document this as beta-acceptable and track for Phase 3. |
| F-05 | **P2** | Resilience | All page routes | No React error boundaries on any page. An unexpected throw in `PlanTable`, `ReviewContent`, `getActivePlan`, etc. will show the raw Next.js error UI in development and a generic 500 in production. | Add a root-level `error.tsx` (Next.js App Router) and page-specific error boundaries for `plan`, `session/[id]`, and `onboarding/review`. |
| F-06 | **P3** | Code Quality | `app/(app)/plan/page.tsx:6-12`, `app/(app)/session/[id]/page.tsx:44-50`, `app/onboarding/review/review-content.tsx:41-47` | `distanceLabel()` function is copy-pasted across 3 files with slightly different logic (review-content uses exact equality, others use range comparisons). | Extract to `lib/utils.ts` or `lib/plans/view-helpers.ts` as a single canonical helper. |
| F-07 | **P3** | Dev hygiene | `app/api/dev/session/route.ts:13` | Hardcoded real-looking email `jvishu21@gmail.com` as the default test account. While the endpoint is guarded by `NODE_ENV !== 'development'`, real email addresses should not appear in source code. | Use a clearly synthetic address like `dev-seed@subtwo.local` or read from env var `DEV_SEED_EMAIL`. |
| F-08 | **P3** | Type Safety | `app/api/plans/[id]/activate/route.ts:52`, `app/api/plans/[id]/regenerate/route.ts:147` | `UntypedRpc` interface uses `as unknown as UntypedRpc` cast to call RPCs (`activate_plan`, `create_plan_version`) added in migration 022 but not yet reflected in the generated DB types. This bypasses compile-time type checking for these calls. | Run `pnpm db:types` to regenerate `types/database.types.ts` after migrations 020-022 are applied to the target env, then remove the `UntypedRpc` workaround. |
| F-09 | **P3** | Convention | `proxy.ts` (root) | Middleware is defined in a file named `proxy.ts` exporting a function named `proxy`. Next.js 16 changed the middleware convention — this appears intentional (build confirms `ƒ Proxy (Middleware)`), but it differs from all Next.js 13-15 documentation and will confuse developers. | Verify against `node_modules/next/dist/docs/` that `proxy.ts` is the documented Next.js 16 convention. Add a comment in the file linking to the relevant doc section. |
| F-10 | **P3** | Security | `app/api/auth/logout/route.ts` | Logout POST has no CSRF protection. A malicious third-party site can trigger a cross-origin POST to `/api/auth/logout` and force-log a user out. Damage is limited (no data loss, user can re-login) but is an easily-abused UX vector. | Check `Origin` / `Referer` header against `NEXT_PUBLIC_APP_URL`, or set `SameSite=Lax` on session cookies (verify Supabase SSR default). |

---

## Route Coverage Matrix

| Route | Auth Guard (Middleware) | Server-side Guard | Error Boundary | Loading State | Empty State |
|-------|------------------------|-------------------|----------------|---------------|-------------|
| `/` | ✅ (public) | n/a | None | n/a | n/a |
| `/login` | ✅ (redirects authed users → /dashboard) | n/a | None | n/a | n/a |
| `/signup` | ✅ (redirects authed users → /dashboard) | n/a | None | n/a | n/a |
| `/auth/callback` | ✅ (public, auth route) | n/a | None | n/a | n/a |
| `/dashboard` | ✅ 307 → /login | `requireUser()` | None | n/a (SSR) | Stub only |
| `/plan` | ✅ 307 → /login | `requireUser()` | None | n/a (SSR) | `PlanTableEmpty` ✅ |
| `/session/[id]` | ✅ 307 → /login | `requireUser()` | None | n/a (SSR) | `notFound()` ✅ |
| `/onboarding/wizard` | ✅ 307 → /login | n/a (client) | None | None | n/a |
| `/onboarding/review` | ✅ 307 → /login | n/a (client) | None | Suspense + spinner ✅ | Error card ✅ |
| `/admin` | ✅ 307 → /login | `requireAdmin()` ✅ | None | n/a (SSR) | Stub only |
| `POST /api/auth/login` | n/a (public) | n/a | n/a | n/a | n/a |
| `POST /api/auth/signup` | n/a (public) | Rate limit + invite | n/a | n/a | n/a |
| `POST /api/auth/logout` | n/a (public) | None | n/a | n/a | n/a |
| `GET /api/plans/[id]` | n/a | `getUser()` + ownership | n/a | n/a | n/a |
| `POST /api/plans/generate` | n/a | `getUser()` + quota | n/a | n/a | n/a |
| `POST /api/plans/[id]/activate` | n/a | `getUser()` + ownership | n/a | n/a | n/a |
| `POST /api/plans/[id]/regenerate` | n/a | `getUser()` + ownership + quota | n/a | n/a | n/a |
| `GET /api/dev/session` | n/a | `NODE_ENV` guard ✅ | n/a | n/a | n/a |

---

## RLS Coverage (15 Tables)

Migration 016 + additive migrations 020-022.

| Table | Policy | Notes |
|-------|--------|-------|
| `profiles` | owner read + update | ✅ |
| `invite_codes` | admin full access | ✅ |
| `plans` | owner full + viewer read | ✅ |
| `plan_versions` | owner full + viewer read (via plan join) | ✅ |
| `planned_sessions` | owner full + viewer read (via plan join) | ✅ |
| `runs` | owner full + viewer read | ✅ |
| `daily_checkins` | owner full + viewer read | ✅ |
| `checkpoints` | owner full + viewer read | ✅ |
| `niggles` | owner full + viewer read | ✅ |
| `plan_adjustments` | owner full + viewer read (via plan join) | ✅ |
| `viewer_access` | athlete manages + viewer reads own | ✅ |
| `run_comments` | author owns + viewer can insert/read (gated by `can_comment`) | ✅ |
| `integrations` | owner full | ✅ |
| `ai_generations` | owner full | ✅ |
| `audit_log` | zero client policies = deny all (service role bypasses) | ✅ intentional |

---

## Phase C — Headless Browser Smoke

**Note:** Playwright MCP server is not configured in this environment. Screenshots could not be captured. HTTP-level checks were performed instead using `Invoke-WebRequest`.

| Check | Result | Notes |
|-------|--------|-------|
| `GET /` (public landing) | ✅ 200, 12.5 KB | Page renders |
| `GET /login` (public) | ✅ 200, 18.7 KB | Page renders |
| `GET /signup` (public) | ✅ 200, 19.8 KB | Page renders |
| `GET /dashboard` (protected, no auth) | ✅ 307 → /login | Middleware redirect works |
| `GET /plan` (protected, no auth) | ✅ 307 → /login | Middleware redirect works |
| `GET /onboarding/wizard` (protected) | ✅ 307 → /login | Middleware redirect works |
| `GET /admin` (protected) | ✅ 307 → /login | Middleware redirect works |
| `POST /api/auth/signup` with `invite_code: "AAAAAAAA"` | ✅ 400 `invalid_invite` | Correct error message shown |
| `POST /api/auth/signup` with `invite_code: "short"` | ✅ 400 `invalid_invite` | Format validation catches it |
| `GET /auth/callback?code=fake&next=http://evil.com` | ⚠️ 307 → /login (fake code fail) | Code exchange fails so safe, but valid code + malicious next = open redirect (F-01) |
| Screenshots (375/768/1440 viewports) | ❌ Not captured | Playwright MCP not available; requires manual verification |
| Console errors / layout overflow / contrast | ❌ Not checked | Requires Playwright or manual browser test |

---

## Scope — Intentionally Skipped (Unbuilt Features)

The following are Phase 2-3 backlog items, not defects:

- Run logging (`/log`, `POST /api/runs`)
- Daily check-in (`/check-in`, `POST /api/checkins`)
- Dashboard trends and training summary (stub page only)
- Checkpoints flow
- Niggles tracker
- Plan sharing / viewer access UI
- Admin console (invite code management, user list, AI usage)
- Comments on sessions (stub shown in session page)
- External integrations (Garmin, Strava, etc.)

---

## Appendix — Test Counts

| Suite | Files | Tests | Passed | Failed |
|-------|-------|-------|--------|--------|
| Unit | 17 | 409 | 409 | 0 |
| Integration (ex. ai-live) | 5 | 28 | 28 | 0 |
| Integration (ai-live, known timeout) | 1 | 1 | 0 | 1 (excluded) |

---

*This document is read-only findings. No code was modified during this audit. Triage to DEFECTS.md and fold fixes into Days 13-15 as appropriate.*
