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

## DEF-004 | AI output silently caps at ~8-9K tokens despite max_tokens 16000
- Severity: S2
- Reported: Day 11 by Code
- Trace: lib/ai/anthropic-client.ts, lib/ai/prompt-builder.ts
- Reproduction: generate plan >20 weeks → JSON truncated mid-output → `stage: 'json_parse'` failure; 2-3 retries needed
- Root cause: single-call generation of full plan with verbose session notes exceeds practical output budget per API call for claude-sonnet-4-6 (~8-9K tokens effective limit despite `max_tokens: 16000` setting)
- Fix: PROPOSED — batch generation (skeleton + pace zones call 1; weeks in batches of ~8 in subsequent calls; stitch + validate). Defer implementation to Phase 3 (P3-AI-BATCH).
- Status: 🟡 mitigated by retry loop; proper fix scheduled P3-AI-BATCH

---

## Fixed

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
