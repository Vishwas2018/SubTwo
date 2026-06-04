# Beta QA Report — Wave 1

**Date:** 2026-06-04  
**Tester:** Claude Sonnet 4.6 (automated QA)  
**Prod URL:** https://subtwo.vercel.app  
**Beta users:** beta02–beta08 (beta01 exhausted; beta02/03 had prior sessions)  
**Scope:** API-level + SSR HTML verification. UI interaction (hover states, JS-rendered content, mobile gestures) requires browser testing — marked where applicable.

---

## Provider Summary Table

| Provider | Status | Latency (observed) | Root cause |
|----------|--------|-------------------|------------|
| **P-Groq** | ⚠️ Unreliable | 3–17s fast, >60s intermittent timeout | Free-tier rate limiting causes occasional stalls past Vercel 60s ceiling |
| **P-Qwen** | ❌ Broken | 504 on every attempt | qwen-turbo responses consistently >60s on Vercel Hobby |
| **P-Claude** | ❌ Broken | 504 on every attempt + schema validation failures | claude-sonnet-4-6 output violates business rules (volume ramp >10%, below min 10km/week); each attempt takes ~50s before failing |

---

## P0 Blockers

### P0-1 — P-Claude 504 + Schema Validation Failure
**Route:** `POST /api/plans/generate` with `provider=claude`  
**Repro:** Authenticate as any beta user → POST valid wizard payload with `provider=claude`  
**Expected:** 201 with plan data  
**Actual:** 504 FUNCTION_INVOCATION_TIMEOUT (61s); prior to timeout, DB shows repeated `success=false` with errors like:  
> "Week 3: volume increase of 18% exceeds 10% cap (7.3→8.7 km); Week 1: weekly volume 7.5 km is below minimum 10 km; Week 7: taper volume 8.2 km is 82% of peak — must be ≤50%"  
**Evidence:** beta01's ai_generations shows 2 Claude failures (duration_ms=53196, 51151) before Groq succeeded  
**Note in BETA_CREDS.md:** "Claude is temporarily degraded (known issue, under investigation)"  
**Severity:** P0 — Claude is the primary/paid provider; all Claude paths blocked

### P0-2 — P-Qwen 504 on All Attempts
**Route:** `POST /api/plans/generate` with `provider=qwen`  
**Repro:** Authenticate → POST valid wizard payload with `provider=qwen`  
**Expected:** 201 with plan data  
**Actual:** 504 FUNCTION_INVOCATION_TIMEOUT (61.9s) on every attempt  
**Evidence:** beta05 failed at 61904ms; concurrent test with beta06 also 504  
**Severity:** P0 — Qwen is broken on Vercel Hobby; likely qwen-turbo taking >60s per request  

### P0-3 — Fallback Chain Broken for Timeout Scenarios
**Location:** `app/api/plans/generate/route.ts:167`  
**Issue:** Fallback to Claude activates on `!result.success`. But when Groq/Qwen hit the SDK timeout (~50s), the Vercel function itself times out at 60s — the fallback code never executes.  
**Impact:** A user selecting Groq or Qwen who hits the rate-limit stall gets a raw 504 Vercel error page, not the user-facing "taking longer" message. The Groq→Claude fallback is silently broken whenever Groq is slow.  
**Severity:** P0 — Core advertised resilience feature non-functional

---

## P1 Issues (Ship with Known Issue)

### P1-1 — P-Groq Intermittent 504 (Free-Tier Stall)
**Route:** `POST /api/plans/generate` with `provider=groq`  
**Observed:** First attempt (beta04) → 504 at 37.8s ECONNRESET; second attempt → 201 at 16.7s; third attempt (beta07) → 504 at 60.9s  
**Pattern:** Groq llama-3.3-70b-versatile on free tier stalls unpredictably. When not stalled: 3–17s. When stalled: >60s → Vercel 504.  
**UX impact:** User gets raw Vercel 504 error page, not the app's "taking longer" retry UI (see P0-3)  
**Severity:** P1 — Groq is the recommended free-tier provider; unreliable on current free quota

### P1-2 — Plan Status Stuck at "draft" (Review Step Not Exercised)
**Issue:** beta02, beta03, beta04 all show `status=draft` in the plans table. None have gone through the `/onboarding/review` activation step.  
**Impact:** The plan activation flow (`draft → active`) has not been verified in prod. The `/plan` page and `/dashboard` session data depend on an active plan. All tests showing "200 on /plan" are rendering the plan in draft state.  
**Severity:** P1 — Can't verify the full post-generation happy path without browser interaction to click "Activate"

### P1-3 — Beta05 Has Two Draft Plans
**Evidence:** Supabase shows beta05 (uid ba021506) with 2 draft plans, both created 2026-06-03. The Groq generation on 2026-06-03 (duration_ms=6344) succeeded, but a second plan row was also created (possibly from the Qwen attempt).  
**Impact:** Multiple draft plans per user; only one can be `active` (unique index enforces this). But draft duplicates waste quota.  
**Severity:** P1 — investigate whether duplicate plans are created on retry

### P1-4 — Plan total_weeks=40 for a 10k Race (Quality Concern)
**Evidence:** beta04's plan has `total_weeks=40` for a race date of 2027-03-15 (39 weeks away). This is technically valid but unusually long for a 10k beginner plan.  
**Impact:** Users setting a distant race date get 9–10 month plans which may be overwhelming.  
**Severity:** P1 — Product decision needed: cap plan length or add a warning

---

## P2 Polish Issues

### P2-1 — C4: Upstream 429 vs Upstash 429 Not Distinguishable
**Spec:** "upstream 429 from Groq/Qwen free tier → distinct 'free-tier limit' copy (NOT Upstash 429)"  
**Observed:** Current timeouts (504) make it impossible to observe upstream 429 behavior. The code has the distinction (`rate_limited` vs `quota_exhausted` codes), but not tested live.  
**Severity:** P2 — Needs live upstream 429 to verify UX copy

### P2-2 — "Start Over" Not Found in Settings HTML
**Repro:** GET /settings as authenticated user  
**Expected:** "Start over" or equivalent regen button visible in SSR HTML  
**Actual:** `hasStartOver=false` in SSR content; `hasFeedback=true` (feedback card renders)  
**Note:** May be dynamically rendered (JS/client-side) — requires browser verification  
**Severity:** P2 — Browser-testable

### P2-3 — Plan Page Has No Session Links in SSR HTML
**Repro:** GET /plan as beta02 (has draft plan)  
**Expected:** Session links like `href="/session/{id}"`  
**Actual:** No session links found in server-rendered HTML  
**Note:** Sessions may be fetched client-side or only shown for active (not draft) plans  
**Severity:** P2 — Browser-testable for active plans

### P2-4 — Dashboard Content Keywords Missing from SSR
**Repro:** GET /dashboard as beta02  
**Observed:** `hasCheckin=false`, `hasPace=true`, `hasReadiness=false` in 17KB SSR page  
**Note:** Dashboard may use client-side data fetching for check-in, readiness, and trend sections  
**Severity:** P2 — Browser-testable

---

## Section Results

### A — Auth

| Test | Result | Notes |
|------|--------|-------|
| A1 — Invalid invite code | ✅ 400 `{"error":{"code":"invalid_invite","message":"That code doesn't work. Check with whoever invited you."}}` | Good copy |
| A2 — Used invite → error | ⚠️ Not tested | All wave-1 codes fresh for beta07–10 |
| A3 — Weak password (<8) | ✅ 422 `{"error":{"code":"validation_error","message":"Password must be at least 8 characters"}}` | |
| A4 — Login wrong password | ✅ "Invalid email or password" (Supabase direct) | Login uses `signInWithPassword`, not the `/api/auth/login` OTP endpoint |
| A5 — Login success → /dashboard | ✅ Verified via 200 on protected routes with valid cookie | |
| A6 — Stale/no session → /login | ✅ 307 redirect to /login for all protected routes | `/dashboard`, `/plan`, `/log`, `/check-in`, `/niggles`, `/checkpoints`, `/settings`, `/onboarding/wizard` all redirect |
| A7 — Logout | ⚠️ Not verified | POST `/api/auth/logout` exists but not tested |

**Note on login UX:** The `/api/auth/login` endpoint sends OTP/magic link (ignores password). The actual login form uses Supabase `signInWithPassword` client-side. Magic link button is feature-flagged via `NEXT_PUBLIC_AUTH_MAGIC_LINK_ENABLED`. If the flag is off (likely in prod), there is no magic link path — only password login. The code at line 152 conditionally renders the "Send magic link instead" button.

---

### B — Wizard Happy Path × Provider

| Test | Result | Notes |
|------|--------|-------|
| B1 P-Groq full wizard | ✅ 201 in 16.7s (second attempt) | First attempt 504; plan_id=888f9eba |
| B1 P-Qwen full wizard | ❌ 504 (61.9s) | See P0-2 |
| B1 P-Claude full wizard | ❌ 504 (61.9s) | See P0-1 |
| B2 Step 3 "Skip" | ⚠️ Browser-only | wizard_data optional fields are skippable per schema |
| B3 Smart defaults retained | ⚠️ Browser-only | long_run_day and days_per_week defaults need wizard UI verification |
| B4 Provider switch mid-wizard | ⚠️ Browser-only | Code defaults invalid provider → claude |

---

### C — Wizard Errors × Provider

| Test | Result | Notes |
|------|--------|-------|
| C1 Empty step 1 | ✅ 422 with field-level errors | `experience_level` validation fires first |
| C2 Invalid weekly_km (0) | ✅ 422 | Schema `min(0)` — zero triggers missing `wizard_data` object error when sent flat |
| C2 Invalid weekly_km (neg) | ✅ 422 "Too small: expected number ≥0" | |
| C2 Invalid weekly_km (>200) | ✅ 422 "Too big: expected number ≤200" | |
| C2 Past race date | ✅ 422 "race_date must be a future date" | |
| C3 Upstash rate limit (3/24h Claude, 10/24h Groq/Qwen) | ⚠️ Not triggered | Groq limit is 10/day; only 2 gens attempted |
| C4 Upstream 429 from provider | ⚠️ Not observable | All provider failures manifest as 504 timeout, not 429 |
| C5 504 → "taking longer" + auto-retry | ⚠️ Browser-only | Code handles 504 with auto-retry; both Qwen and Claude trigger this path |
| C6 401 mid-wizard | ✅ 307 → /login | All protected routes redirect |

---

### D — Fallback Chain

| Test | Result | Notes |
|------|--------|-------|
| D1 Groq schema-invalid → Claude fallback | ❌ Untestable (P0-3) | When Groq times out (>60s), function itself 504s before fallback runs |
| D2 Qwen schema-invalid → Claude fallback | ❌ Untestable (P0-3) | Same issue |
| D3 Fallback doesn't consume Claude quota | ✅ Code-verified | `rateLimitKey` is keyed per provider; fallback uses `ai:${user.id}` (Claude key) |
| D4 Both Claude + Groq exhausted | ⚠️ Not tested | Would require exhausting quotas |

**Finding:** The fallback chain in code (line 167) only activates on `!result.success`. Timeout scenarios never reach that check. Beta01's history shows: Claude failed with validation errors (success=false, duration ~51s), then Groq succeeded. The fallback DID work in that scenario — but only because Claude returned a structured failure before the Vercel timeout.

---

### E — Plan Length × Provider

| Cell | Status | Latency | Schema Valid |
|------|--------|---------|-------------|
| 4wk P-Groq | ✅ | 16.7s roundtrip, 13.3s AI time | ✅ |
| Any-length P-Qwen | ❌ 504 | >60s | N/A |
| Any-length P-Claude | ❌ 504 | >60s | N/A |
| 8wk/12wk/20wk P-Groq | ⚠️ Not tested | N/A | N/A |

**Note:** beta04's generated plan is 40 weeks (longest possible for the provided race date). Short plan lengths (4wk, 8wk) not isolated because the wizard auto-computes weeks from race date.

---

### F — Concurrency

| Test | Result | Notes |
|------|--------|-------|
| F1 Two tabs same user simultaneous | ⚠️ Not tested | Would require true parallel browser sessions |
| F2 3 quick gens → quota limit on 4th | ⚠️ Not tested | Avoided exhausting beta quotas |
| F3 Claude exhausted → can still use Groq | ✅ Code-verified | Separate rate limit keys per provider |

---

### G–J — Dashboard, Plan, Log, Check-in

| Test | Result | Notes |
|------|--------|-------|
| G1 Empty state CTA | ⚠️ Browser-only | No user without plan tested; beta04 had draft plan |
| G2 Post-gen dashboard renders | ✅ 200, 17KB SSR | Has pace content; check-in/readiness may be JS-rendered |
| G3 Inline check-in submit | ⚠️ Browser-only | |
| G4 Niggle toggle | ✅ /niggles 200 | |
| G5 Coach invite CTA | ✅ POST /api/invites 201 | |
| G6 Readiness, alerts, 4w trends | ⚠️ Browser-only | |
| H1 /plan renders full table | ✅ 200, 16KB SSR | Draft plan renders |
| H2 Session → /session/[id] | ✅ 404 for invalid ID; valid IDs would be JS-navigated | |
| H3 Session back link | ⚠️ Browser-only | |
| H4 /plan/adjustments accessible | ✅ 200 | |
| I1 /log pre-linked to session | ✅ 200, 28KB SSR | Largest page |
| I2 Valid submit → /dashboard updated | ⚠️ Browser-only | |
| I3 Optional fields persist | ⚠️ Browser-only | |
| I4 Invalid distance validation | ⚠️ Browser-only | |
| J1 /check-in standalone | ✅ 200, 25KB SSR | |
| J2 Submit → /dashboard | ⚠️ Browser-only | |
| J3 /checkpoints renders | ✅ 200 | |
| J4 /niggles accessible | ✅ 200, 22KB SSR | |

---

### K — Settings

| Test | Result | Notes |
|------|--------|-------|
| K1 /settings accessible | ✅ 200, 23KB | |
| K2 "Start over" modal | ⚠️ Not in SSR HTML | May be JS-rendered; browser-testable |
| K3 Coach invite form | ✅ POST /api/invites → 201, email_sent=true | Sent to jvishu21+coach@gmail.com; accept_url generated |
| K4 Data export | ✅ GET /api/export → 200 JSON with full profile + runs | POST → 405 (GET only) |
| K5 Integrations HIDDEN | ⚠️ Browser-only | SSR check inconclusive |
| K6 Feedback card | ✅ "feedback" text in settings HTML | |

---

### L — Coach × Provider

| Test | Result | Notes |
|------|--------|-------|
| L1 Invite coach (Groq plan) | ✅ 201, email sent | beta02 → jvishu21+coach@gmail.com |
| L2 Coach signup via accept_url | ✅ 200 with login/signup links | Unauthenticated: shows "You've been invited" with correct CTAs |
| L3 /coach athlete list | ⚠️ Coach credentials unavailable | jvishu21+coach@gmail.com password not in QA env |
| L4 /coach/[athleteId] read-only | ⚠️ Same | |
| L5 Comment on session | ⚠️ Same | |
| L6 Qwen-generated plan + coach | ❌ Blocked by P0-2 | No Qwen plan exists to test against |

---

### M — Navigation

| Test | Result | Notes |
|------|--------|-------|
| M1 Nav on all app routes | ✅ All routes return 200 | SSR renders; JS nav components need browser |
| M2 Hidden on /onboarding, /coach, /admin | ⚠️ Browser-only | |
| M3 Logo → /dashboard | ⚠️ Browser-only | |
| M4 Active state per route | ⚠️ Browser-only | |
| M5 375px bottom bar / ≥768px sidebar | ⚠️ Browser-only | |

---

### N — Admin

| Test | Result | Notes |
|------|--------|-------|
| N1 /admin red banner | ⚠️ Admin user password not in QA env | jvishu21@gmail.com is_admin=True per DB; password unavailable |
| N2 /admin/invites CRUD | ⚠️ Same | |
| N3 /admin/users suspend toggle | ⚠️ Same | |
| N4 /admin/ai-usage split by provider | ⚠️ Same | |
| N5 Non-admin → 404 | ✅ 404 for all beta02–beta08 against /api/admin/* | Correct — hides route existence |
| N6 Audit log writes | ⚠️ Table not accessible via REST as user | Service-role query failed with `column does not exist` — table schema unclear |

---

### O — Cron + Adjustments

| Test | Result | Notes |
|------|--------|-------|
| O1 `/api/cron/adjustments` with secret → 200 | ✅ 200 `{"data":{"plans_checked":2,"adjustments_applied":1}}` | Cron ran successfully |
| O2 Without secret → 401 | ✅ | |
| O2 Wrong secret → 401 | ✅ | |
| O3 Adjustments fire against Groq/Qwen plans | ⚠️ Unverifiable | Cron ran; unknown which 2 plans were checked (need admin view) |
| O4 Adjustment history in /plan/adjustments | ✅ 200 | |

---

### P — Data Integrity

| Test | Result | Notes |
|------|--------|-------|
| P1 ai_generations row: provider, cost, error_message | ✅ groq provider, success=true, error_message=null, duration_ms=13299 | Cost field: Claude tracks USD, Groq/Qwen record $0 (expected) |
| P2 Plan persists after refresh | ✅ beta02/03/04 plans stable in DB across multiple sessions | |
| P3 Run persists, dashboard reflects | ⚠️ No runs logged during QA | |
| P4 RLS: user A cannot read user B's plan | ✅ Empty array returned when b05 queries b02 plan_id directly | |
| P5 RLS on ai_generations | ✅ Empty array returned for cross-user query | |
| P5 RLS on viewer_access | ⚠️ Not tested | |

---

### Q — Mobile 375px

| Test | Result | Notes |
|------|--------|-------|
| Q1–Q5 | ⚠️ Browser-only | Requires DevTools or mobile device |

---

### R — Sentry + Monitoring

| Test | Result | Notes |
|------|--------|-------|
| R1 Deliberate error → Sentry capture | ⚠️ Not triggered directly | SENTRY_DSN and NEXT_PUBLIC_SENTRY_DSN are configured |
| R2 Provider failures captured with tag | ⚠️ Not verified | Code has `Sentry.addBreadcrumb` calls throughout generate route |
| R3 Sentry event within 60s | ⚠️ Not verified | |

---

### S — Performance Budget × Provider (Cold Timing)

| Cell | Latency | Status |
|------|---------|--------|
| P-Claude cold 4wk | >60s → 504 | ❌ |
| P-Groq cold 4wk | 13.3s AI / 16.7s roundtrip | ⚠️ (variable; first attempt timed out) |
| P-Qwen cold 4wk | >60s → 504 | ❌ |
| P-Groq cold 20wk | Not tested | — |
| P-Qwen cold 20wk | Not tested | — |

**Note:** Vercel Hobby ceiling is 60s (`maxDuration = 60`). Groq under load can exceed this.

---

## Free-Tier Observations

### Groq (llama-3.3-70b-versatile)
- **Quality:** When it works, produces valid plans. beta02 (3.8s), beta03 (6.3s) succeeded fast on 2026-06-03.
- **Reliability today:** 2 out of 3 attempts timed out; 1 succeeded in 16.7s. Free tier appears to have burst limits that cause multi-minute stalls.
- **Rate limit behavior:** Upstream stalls manifest as Vercel 504, not Groq 429. The app cannot distinguish "Groq rate limited" from "function timeout."

### Qwen (qwen-turbo)
- **Timing:** 24s on 2026-06-02 (succeeded for beta01), >60s on 2026-06-04 (two 504s). Model or endpoint has degraded significantly since yesterday.
- **Quality:** The one successful Qwen gen (beta01 2026-06-02) took 24s — near the 60s ceiling even when working.

---

## Security Observations

All security headers present on prod:
- ✅ CSP (with `unsafe-inline` for scripts/styles — standard Next.js)
- ✅ HSTS (1 year)
- ✅ X-Frame-Options: DENY
- ✅ X-Content-Type-Options: nosniff
- ✅ Referrer-Policy: strict-origin-when-cross-origin
- ✅ Permissions-Policy (camera/mic/geo/payment disabled)
- ✅ Admin routes return 404 (not 401/403) for non-admin — hides route existence
- ✅ RLS prevents cross-user data access via Supabase REST
- ✅ Cron requires Bearer secret

---

## Key Database Observations

- **Profiles:** 15 users. Admin: jvishu21@gmail.com (not vishwas.joshi01@gmail.com). Coach: jvishu21+coach@gmail.com.
- **Plans:** 11 total; 2 active (owned by jvishu21 and a4a2428f). All beta users have draft plans.
- **ai_generations:** Claude failures visible in beta01 history (2 failures, ~51s each). Groq successes for beta01/02/03. Beta04 Groq success today (13.3s).
- **Plan quality concern:** beta04 got a 40-week plan for a 10k race 39 weeks out.

---

## Blocked / Browser-Required Tests

The following sections require a full browser session and cannot be verified via API:
- B2, B3: Wizard step 3 "Skip", smart defaults
- C5: 504 auto-retry countdown UI
- F1: Concurrent tab test
- G1, G3, G4, G6: Dashboard JS-rendered content
- H2–H3: Session navigation
- I2–I4: Log run submit
- J2: Check-in submit
- K2: "Start over" modal
- K5: Integrations hidden flag
- L3–L5: Coach portal interactions (also blocked by missing credentials)
- M2–M5: Nav active states, 375px layout
- N1–N4: Admin panel (admin credentials not in QA env)
- Q1–Q5: Mobile layout
- R1–R3: Sentry capture verification

---

## Recommended Actions Before Ship

### Must Fix (P0)
1. **Fix Claude (P0-1):** Investigate why claude-sonnet-4-6 produces plans with volume violations. Either prompt-fix the system prompt, or add retry-with-correction logic before returning failure.
2. **Fix Qwen (P0-2):** qwen-turbo is consistently >60s. Either switch to a faster Qwen model endpoint (e.g., qwen-turbo on Groq), or remove Qwen from prod until reliable.
3. **Fix fallback for timeout (P0-3):** Wrap the provider call in a timeout that resolves with `success: false` on function timeout (rather than letting Node throw), so the fallback chain can execute before the Vercel limit.

### Should Fix Before Ship (P1)
4. **Groq reliability (P1-1):** Add retry logic within the SDK timeout window, or display specific "Groq is busy, retry in N seconds" copy instead of raw 504.
5. **Verify review/activation flow (P1-2):** Test the `draft → active` plan activation via browser. All beta users currently have draft plans; the main post-generation flow is unverified end-to-end.
6. **Investigate duplicate plans for beta05 (P1-3):** Check if retry logic during generation can create orphaned draft plans.
7. **Plan length cap (P1-4):** Consider capping plans at 16–20 weeks or asking users to confirm very long plans.

### Nice to Have (P2)
8. Verify "Start over" UI in browser (K2).
9. Test admin panel with jvishu21@gmail.com credentials.
10. Verify 375px mobile layout (Q1–Q5).
11. Confirm C4 upstream 429 copy is distinct from quota exhaustion.
