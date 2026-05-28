# BACKLOG

## SubTwo — Product Backlog

**Owner:** [CLAUDE WEB - OPUS 4.7] | **Last updated:** Day 12

---

## Status legend

🔵 todo · 🟡 in-progress · 🟢 done · ⚪ deferred · 🔴 blocked

---

## Phase 1 — Foundation & Core Logic

| ID     | Task                                                                      | Status | Notes          |
| ------ | ------------------------------------------------------------------------- | ------ | -------------- |
| P1-01  | Next.js 15 + TS + Tailwind + shadcn init, GitHub push, Vercel deploy      | 🟢     | Day 1          |
| P1-02  | Supabase project (ap-southeast-2) + CLI + migrations folder               | 🟢     | Day 1          |
| P1-03  | Migrations 001–015 (all 15 tables)                                        | 🟢     | Day 2          |
| P1-04  | Migration 016: RLS policies + cross-user test                             | 🟢     | Day 2          |
| P1-05  | Migration 017–018: indexes + helper functions                             | 🟢     | Day 3          |
| P1-05b | Migration 019: admin seed trigger (jvishu21@gmail.com)                    | 🟢     | Day 3          |
| P1-06  | `lib/pace-zones.ts` + 20+ unit tests (100% coverage)                      | 🟢     | Day 3          |
| P1-07  | `lib/plan-validators.ts` (10% rule, deload, pace consistency) + 15+ tests | 🟢     | Day 4          |
| P1-08  | `lib/checkpoint-logic.ts` + boundary tests                                | 🟢     | Day 4          |
| P1-09  | Zod schemas (WizardInput, GeneratedPlan, RunInput, CheckinInput)          | 🟢     | Day 5          |
| P1-10  | Supabase auth wiring + middleware + session helpers                       | 🟢     | Day 5          |
| P1-11  | Signup with invite code (atomic validation)                               | 🟢     | Day 6          |
| P1-12  | Admin role + `/admin` route guard + seed admin                            | 🟢     | Day 6          |
| P1-13  | CI pipeline (GitHub Actions: lint + typecheck + tests)                    | 🟢     | Day 7          |
| P1-14  | Control documents initialized                                             | 🟢     | Day 1 complete |

## Phase 2 — Feature Integration

| ID    | Task                                             | Status |
| ----- | ------------------------------------------------ | ------ |
| P2-01 | Wizard UI shell (7 steps, conditional branching) | 🟢     | Day 10 |
| P2-02 | System prompt for plan generation (~3000 tokens) | 🟢     |
| P2-03 | Anthropic SDK integration + retry logic          | 🟢     |
| P2-04  | Plan validation pipeline (Zod + math)            | 🟢     | Day 9 |
| P2-04b | POST /api/plans/generate (auth+quota+persist)    | 🟢     | Day 9 |
| P2-05  | DB write transaction (plan + version + sessions) | 🟢     | Day 9 |
| P2-06  | `/onboarding/review` screen                      | 🟢     | Day 11 |
| P2-07 | `/plan` calendar view                            | 🟢     | Day 12 |
| P2-08 | `/session/[id]` detail page                      | 🟢     | Day 12 |
| P2-09 | `/log` manual run entry                          | 🟢     | Day 13 |
| P2-10 | `/check-in` daily form                           | 🟢     | Day 13 |
| P2-11 | `/checkpoints` UI + verdict display              | 🟢     | Day 14 |
| P2-12 | `/niggles` log UI                                | 🟢     | Day 14 |
| P2-13 | `/dashboard` with trends + alerts                | 🟢     | Day 15 |
| P2-14 | `/settings` (profile, data export)               | 🟢     | Day 15 |

## Phase 3 — Hardening

| ID          | Task                                                     | Status |
| ----------- | -------------------------------------------------------- | ------ |
| P3-AI-BATCH | Batch plan generation (skeleton + weekly batches; stitch + validate) | 🟢 | Day 16 |
| P3-01 | Upstash rate limiting on auth + AI endpoints             | 🟢     | Day 17 |
| P3-02 | Automated RLS audit script                               | 🟢     | Day 22 — `get_rls_audit()` SQL fn (migration 026) + `scripts/audit-rls.ts` + `pnpm audit:rls` |
| P3-03 | AI cost caps (lifetime + daily + monthly + admin alerts) | 🟢     | Day 18 |
| P3-04 | Adjustment rules engine (6 rules)                        | 🟢     | Day 19 |
| P3-05 | Nightly cron `/api/cron/adjustments`                     | 🟢     | Day 19 |
| P3-06 | `audit_log` writes on sensitive actions                  | 🟢     | Day 22 — `lib/audit/log.ts` helper; admin invite/user/coach invite routes; standardised cron + budget writes |
| P3-07 | Sentry error tracking                                    | 🟢     | Day 22 — client/server/edge configs; `instrumentation.ts` + `instrumentation-client.ts`; tunnel route; PII scrub in `beforeSend`; no-op if DSN absent |
| P3-08 | Coach sharing (invites + view + comments)                | 🟢     | Day 20 |
| P3-09 | Admin console (invites, users, AI usage)                 | 🟢     | Day 21 |
| P3-10 | Error boundaries + empty states + skeletons              | 🟢     | Day 22 — DEF-008 fixed: error.tsx for (app)/(admin)/(coach) + root; Sentry captureException wired; DEF-009 fixed: distanceLabel() extracted to view-helpers.ts |

## Phase 4 — Validation & Release

| ID    | Task                                                        | Status | Notes |
| ----- | ----------------------------------------------------------- | ------ | ----- |
| P4-01 | Playwright E2E tests for happy path                         | ⚠️     | Day 27/29/30: 21/21 green (CI + local desktop + mobile-chrome); @generate UNVERIFIED (rate limit active Day 31) |
| P4-02 | Vercel env audit + production deploy                        | 🟢     | Day 24/25 |
| P4-03 | Post-deploy hardening (RLS, rate-limit revert, make-coach) | 🟢     | Day 25 |
| P4-04 | Beta readiness + first-run polish                           | 🟢     | Day 26 |
| P4-05 | Mobile responsiveness sweep                                 | 🟢     | Day 27 — responsive fixes + E2E mobile-chrome |
| P4-06 | Dark mode toggle                                            | ⚪     | Deferred Phase 5 |
| P4-06b | Warm dark mode Phase B light restyle (warm ivory, Manrope, clay CTAs) | 🟢 | Day 28 — tokens + fonts + primitives; E2E clean |
| P4-06c | Warm dark mode Phase C `.dark {}` restyle                  | ⚪     | Deferred Phase 5 (P4-06b) |
| P4-07 | Runbooks (incident response, key rotation, restore)         | ⚪     | Deferred Phase 5 |
| P4-08 | Production deploy                                           | 🟢     | Day 25 — smoke /, /login → 200; cron 401/200 |

## Phase 5 — AI & Infra Improvements (deferred from P4)

| ID     | Task                                                                                                        | Status | Notes                                   |
| ------ | ----------------------------------------------------------------------------------------------------------- | ------ | --------------------------------------- |
| P5-AI1 | Multi-provider AI selection (Sonnet/Haiku/Opus via env or per-request) — currently hardcoded via ANTHROPIC_MODEL env var | ⚪ deferred | Day 25: Haiku forced due to Vercel Hobby 60s limit; Sonnet viable on Pro plan |
| P5-AI2 | Upgrade Vercel plan (Pro) → raise maxDuration to 300s → re-enable Sonnet 4.6 for plan generation            | ⚪ deferred | Hobby ceiling is root cause of Haiku fallback |
| P5-AI3 | Fix cost logging: `SONNET_PRICING` constant used regardless of model — incorrect for Haiku pricing           | ⚪ deferred | Low cost impact now; fix if model changes |

## Phase 5 — Strava (optional v1)

| ID    | Task                                 | Status |
| ----- | ------------------------------------ | ------ |
| P5-01 | Strava OAuth flow                    | 🔵     |
| P5-02 | Webhook receiver + HMAC verification | 🔵     |
| P5-03 | Activity → run mapping + dedup       | 🔵     |

## Phase 6 — Garmin (post-approval)

| ID    | Task                                      | Status               |
| ----- | ----------------------------------------- | -------------------- |
| P6-01 | Garmin developer app approval             | ⚪ Awaiting approval |
| P6-02 | OAuth 1.0a flow                           | ⚪                   |
| P6-03 | Cron polling sync                         | ⚪                   |
| P6-04 | Dedup with Strava (prefer Garmin HR/elev) | ⚪                   |

---

## User Stories Index

| Story                                 | Trace to             |
| ------------------------------------- | -------------------- |
| Signup with invite code               | P1-11                |
| Generate personalised plan via wizard | P2-01..05            |
| Auto-import runs                      | P5-01..03, P6-01..04 |
| See if on track                       | P2-13                |
| Log checkpoint, get verdict           | P1-08, P2-11         |
| Track niggle                          | P2-12                |
| Coach views progress                  | P3-08                |
| Coach comments on session             | P3-08                |
| Admin generates invites               | P3-09                |

---

## Deferred (Out of v1)

- Public plan sharing / templates marketplace
- Multi-language
- Plan editor (manual override beyond regen)
- Strength plan generation
- AI weekly coaching commentary
- Mobile native app
- Email/push reminders
- Nutrition macro tracking
