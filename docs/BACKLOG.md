# BACKLOG

## SubTwo — Product Backlog

**Owner:** [CLAUDE WEB - OPUS 4.7] | **Last updated:** Day 7 — **Phase 1 COMPLETE**

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
| P2-01 | Wizard UI shell (7 steps, conditional branching) | 🔵     |
| P2-02 | System prompt for plan generation (~3000 tokens) | 🔵     |
| P2-03 | Anthropic SDK integration + retry logic          | 🔵     |
| P2-04 | Plan validation pipeline (Zod + math)            | 🔵     |
| P2-05 | DB write transaction (plan + version + sessions) | 🔵     |
| P2-06 | `/onboarding/review` screen                      | 🔵     |
| P2-07 | `/plan` calendar view                            | 🔵     |
| P2-08 | `/session/[id]` detail page                      | 🔵     |
| P2-09 | `/log` manual run entry                          | 🔵     |
| P2-10 | `/check-in` daily form                           | 🔵     |
| P2-11 | `/checkpoints` UI + verdict display              | 🔵     |
| P2-12 | `/niggles` log UI                                | 🔵     |
| P2-13 | `/dashboard` with trends + alerts                | 🔵     |
| P2-14 | `/settings` (profile, data export)               | 🔵     |

## Phase 3 — Hardening

| ID    | Task                                                     | Status |
| ----- | -------------------------------------------------------- | ------ |
| P3-01 | Upstash rate limiting on auth + AI endpoints             | 🔵     |
| P3-02 | Automated RLS audit script                               | 🔵     |
| P3-03 | AI cost caps (lifetime + daily + monthly + admin alerts) | 🔵     |
| P3-04 | Adjustment rules engine (6 rules)                        | 🔵     |
| P3-05 | Nightly cron `/api/cron/adjustments`                     | 🔵     |
| P3-06 | `audit_log` writes on sensitive actions                  | 🔵     |
| P3-07 | Sentry error tracking                                    | 🔵     |
| P3-08 | Coach sharing (invites + view + comments)                | 🔵     |
| P3-09 | Admin console (invites, users, AI usage)                 | 🔵     |
| P3-10 | Error boundaries + empty states + skeletons              | 🔵     |

## Phase 4 — Validation & Release

| ID    | Task                                                        | Status |
| ----- | ----------------------------------------------------------- | ------ |
| P4-01 | Playwright E2E tests for happy path                         | 🔵     |
| P4-02 | Edge case suite (timezones, leap years, missed cron, quota) | 🔵     |
| P4-03 | Load test AI endpoint                                       | 🔵     |
| P4-04 | PDF export via `@react-pdf/renderer`                        | 🔵     |
| P4-05 | Mobile responsiveness sweep                                 | 🔵     |
| P4-06 | Dark mode toggle                                            | 🔵     |
| P4-07 | Runbooks (incident response, key rotation, restore)         | 🔵     |
| P4-08 | Production deploy + first invite codes generated            | 🔵     |

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
