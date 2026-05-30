# DEFECTS

## SubTwo — Bug & Test Failure Log

**Owner:** [CLAUDE CODE - SONNET 4.6] reports → [CLAUDE WEB - OPUS 4.7] reviews

---

## Status legend

🔴 open · 🟡 in-progress · 🟢 fixed · ⚪ wontfix

## Severity

**S1** prod broken / data loss · **S2** feature broken · **S3** workaround exists · **S4** cosmetic

---

## Open

_(none)_

## DEF-008 | No React error boundaries on app pages
- Severity: S2
- Reported: Day 13 audit (F-05) by Code
- Trace: app/(app)/**, app/(admin)/**, app/(coach)/**
- Reproduction: any unhandled throw in a server component propagates as a 500 with no user-friendly fallback
- Root cause: no `error.tsx` files alongside page.tsx files; Next.js requires co-located error boundaries per route segment
- Fix: Day 22 — added `app/(app)/error.tsx`, `app/(admin)/admin/error.tsx`, `app/(coach)/coach/error.tsx`; updated root `app/error.tsx` to call `captureException` via Sentry; each boundary shows error ID + try-again + contextual back-link
- Status: 🟢

## DEF-009 | distanceLabel() helper duplicated across 5 files
- Severity: S4
- Reported: Day 13 audit (F-06) by Code
- Trace: app/(app)/plan/page.tsx, app/(app)/session/[id]/page.tsx, app/onboarding/review/review-content.tsx, app/(coach)/coach/[athleteId]/page.tsx, app/(coach)/coach/[athleteId]/plan/page.tsx
- Reproduction: any distance formatting change requires edits in 5 places; review-content.tsx used exact-km matching instead of range-based
- Root cause: utility not extracted to lib/plans/view-helpers.ts when those files were created
- Fix: Day 22 — `distanceLabel()` already added to `lib/plans/view-helpers.ts`; all 5 files updated to import from shared location; 10 regression tests added to `tests/unit/plans/view-helpers.test.ts`
- Status: 🟢

## DEF-012 | No security headers configured in next.config.ts
- Severity: S3
- Reported: Day 13 audit (F-10) by Code
- Trace: next.config.ts
- Reproduction: curl -I https://subtwo.vercel.app → no X-Frame-Options, X-Content-Type-Options, Referrer-Policy, or Permissions-Policy
- Root cause: headers() config block not added during Phase 1 scaffold
- Fix: Day 17 — `next.config.ts` headers() block: CSP (default-src self, connect-src Supabase), HSTS (max-age=31536000 includeSubDomains), X-Content-Type-Options nosniff, X-Frame-Options DENY, Referrer-Policy strict-origin-when-cross-origin, Permissions-Policy (camera/mic/geo/payment/usb=()). 8 unit tests verify all headers present + correct values.
- Status: 🟢

---

## Fixed

## DEF-004 | AI output silently caps at ~8-9K tokens despite max_tokens 16000
- Severity: S2
- Reported: Day 11 by Code
- Trace: lib/ai/anthropic-client.ts, lib/ai/prompt-builder.ts
- Reproduction: generate plan >20 weeks → JSON truncated mid-output → `stage: 'json_parse'` failure; 2-3 retries needed
- Root cause: single-call generation of full plan with verbose session notes exceeds practical output budget per API call for claude-sonnet-4-6 (~8-9K tokens effective limit despite `max_tokens: 16000` setting)
- Fix: Day 16 (commit b67067e) — two-phase batch generation: skeleton call (meta + pace zones + checkpoints, ~2-3K output tokens) then 6-week session batches; per-batch retry; assembly validated with GeneratedPlanSchema + validatePlan; routing: ≤12wk single-call, >12wk batch. Live-verified: 19-week plan, 5 API calls, $0.24, no truncation.
- Status: 🟢

## DEF-001 | Middleware infinite redirect loop on /login (startsWith '/log' collision)
- Severity: S1
- Reported: Day 6 E2E gate by Code
- Trace: P1-11, commit b1b534f
- Reproduction: navigate to http://localhost:3000/login → ERR_TOO_MANY_REDIRECTS
- Root cause: `PROTECTED_PREFIXES` contains `'/log'`; `'/login'.startsWith('/log')` is `true`, so the login page was classified as a protected route and redirected unauthenticated users to `/login` → infinite loop
- Fix: commit b1b534f — changed prefix match from `path.startsWith(prefix)` to `path === prefix || path.startsWith(prefix + '/')`
- Status: 🟢

## DEF-002 | Auth callback did not set session cookies on redirect response
- Severity: S2
- Reported: Day 6 E2E gate by Code
- Trace: P1-11, commit b1b534f
- Reproduction: click magic link → callback exchanges code → browser receives redirect to /dashboard with no session cookies → middleware redirects to /login
- Root cause: `createClient()` from `lib/supabase/server.ts` uses `cookies()` from `next/headers`; when `setAll()` is called during `exchangeCodeForSession`, those writes are not attached to the `NextResponse.redirect()` returned from the route handler
- Fix: commit b1b534f — rewrote callback to create the redirect response first and pass it as the cookie target to `createServerClient` directly
- Status: 🟢

## DEF-003 | Middleware redirect responses dropped refreshed session cookies
- Severity: S2
- Reported: Day 6 E2E gate by Code
- Trace: P1-11, commit b1b534f
- Reproduction: any authenticated redirect (e.g. /login → /dashboard) could lose the refreshed access token if the token was silently refreshed during `getUser()`, causing the next request to arrive with an expired token
- Root cause: `NextResponse.redirect()` creates a new response; cookies written to the intermediate `response` variable by `setAll()` were never copied to the redirect response
- Fix: commit b1b534f — after each redirect, copies `response.cookies.getAll()` onto the redirect response
- Status: 🟢

## DEF-005 | Open redirect in /auth/callback via unvalidated `next` param (F-01, P1)
- Severity: S1
- Reported: Day 13 audit by Code
- Trace: app/auth/callback/route.ts — `next` param passed directly to `new URL(next, origin)` without sanitisation
- Reproduction: craft link `/auth/callback?code=valid&next=https://evil.com` → user clicks magic link → browser follows redirect to evil.com with valid session
- Root cause: `next` query param accepted any value including absolute URLs; `new URL('https://evil.com', origin)` resolves to `https://evil.com` regardless of origin
- Fix: Day 13 — validate `next` starts with `/` AND does not start with `//` AND does not contain `://`; reject to `/dashboard`
- Status: 🟢

## DEF-006 | No rate limit on POST /api/auth/login (F-02, P2)
- Severity: S2
- Reported: Day 13 audit by Code
- Trace: app/api/auth/login/route.ts — no `checkLimit` call unlike signup route
- Reproduction: script POST /api/auth/login with any email at >5 req/min → 200 responses with OTP emails sent on each; allows email bombing
- Root cause: login route was written before rate-limit pattern established; not copied from signup
- Fix: Day 13 — add `checkLimit(\`login:\${ip}\`, 5, 60 * 60 * 1000)` before OTP dispatch; returns 429 on breach
- Status: 🟢

## DEF-007 | Non-atomic ai_generation_count increment (F-03, P2)
- Severity: S2
- Reported: Day 13 audit by Code
- Trace: app/api/plans/generate/route.ts:157, app/api/plans/[id]/regenerate/route.ts:171
- Reproduction: two concurrent generation requests → both read `lifetime_used=3`, both write `ai_generation_count=4`; actual count is 5 but column shows 4
- Root cause: read-modify-write pattern using `lifetime_used + 1`; `check_ai_quota` already derives the true count via `COUNT(*) FROM ai_generations WHERE success=true`, making the column redundant
- Fix: Day 13 — removed all writes to `profiles.ai_generation_count`; column left in place (deprecated) but no longer updated; `check_ai_quota` COUNT(*) is the authoritative quota source. No migration needed — column has DEFAULT 0 and no NOT NULL issue with stopping writes.
- Status: 🟢

## DEF-010 | Hardcoded real email in dev session route (F-07, P3)
- Severity: S3
- Reported: Day 13 audit by Code
- Trace: app/api/dev/session/route.ts:13 — `'jvishu21@gmail.com'` hardcoded as default
- Reproduction: `GET /api/dev/session` in dev env without `?email=` param → injects session for admin email
- Root cause: email set during Day 0 and not replaced with env var when route was written
- Fix: Day 13 — replaced with `process.env.DEV_TEST_EMAIL ?? 'dev@localhost'`; real email removed from source
- Status: 🟢

## DEF-011 | UntypedRpc interface bypasses TypeScript safety (F-08, P3)
- Severity: S3
- Reported: Day 13 audit by Code
- Trace: app/api/plans/[id]/activate/route.ts, app/api/plans/[id]/regenerate/route.ts
- Reproduction: `activate_plan` and `create_plan_version` called via `as unknown as UntypedRpc` cast, losing all arg/return type checking
- Root cause: database.types.ts was generated before migrations 022 were applied; the Functions section did not include the two new RPCs
- Fix: Day 13 — manually added `activate_plan` and `create_plan_version` entries to `types/database.types.ts` Functions; removed `UntypedRpc` interface and casts from both routes; types now fully resolved
- Status: 🟢

---

## DEF-012 | Plan generation timeout on Vercel Hobby (P5-AI2)
- Severity: S2
- Reported: 2026-05-30 beta launch by Code
- Trace: app/api/plans/generate/route.ts:16 — `export const maxDuration = 60`; Vercel Hobby hard-caps function execution at 60s; Anthropic SDK timeout set to 55s; any pre-AI overhead reduces available generation window
- Reproduction: generate a plan on Vercel Hobby → wizard may show "Network error" after ~60s; plan not created
- Root cause: Anthropic API call for a full training plan can approach 55s; combined with auth/quota/DB overhead it occasionally exceeds the 60s cap and Vercel terminates the function, returning a network error to the client
- Fix options: (a) Vercel Pro removes the cap; (b) use `claude-haiku-4-5` for faster generation; (c) background job + polling pattern
- Status: 🔴 (open — accepted for beta, fix post-beta)

---

## Already-tracked references

| Finding | Ref | Notes |
|---------|-----|-------|
| F-04: Process-local in-memory rate limiter ineffective in multi-instance prod | TD-009 | Logged Day 6; deferred to Phase 4 (Redis/edge rate limit) |
| F-09: Non-standard proxy.ts middleware filename | DEV-004 | Logged Day 5; intentional deviation from Next.js 16 convention |

---

## Defect Template

```
## DEF-XXX | <one-line summary>
- Severity: S1/S2/S3/S4
- Reported: Day X by <Code/Web>
- Trace: <task ID or commit hash>
- Reproduction: <steps>
- Root cause: <when known>
- Fix: <PR/commit>
- Status: 🔴/🟡/🟢
```
