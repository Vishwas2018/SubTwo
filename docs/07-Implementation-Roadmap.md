# Implementation Roadmap

## SubTwo

**Version:** 1.0 (final) | **Approach:** CCTV protocol, phased, daily cycles

---

## Phases

| Phase                      | Days | Outcome                                                              |
| -------------------------- | ---- | -------------------------------------------------------------------- |
| 1. Foundation & Core Logic | 5–7  | Auth, schema, invite codes, pace/volume math, validators, admin role |
| 2. Feature Integration     | 6–8  | Wizard, AI generation, plan execution, manual run logging            |
| 3. Hardening & Compliance  | 5–7  | Rate limits, RLS audit, AI cost caps, adjustment engine, audit logs  |
| 4. Validation & Release    | 3–5  | E2E tests, edge cases, runbooks, deploy                              |
| 5. Strava Integration      | 2–3  | OAuth + webhook (post-release optional)                              |
| 6. Garmin Integration      | 2    | After API approval                                                   |

**Baseline total:** 19–27 days. Recalibrated weekly by [CLAUDE WEB - OPUS 4.7].

---

## Phase 1 — Foundation & Core Logic (Days 1–7)

| ID    | Task                                                             | Est | Gate                      |
| ----- | ---------------------------------------------------------------- | --- | ------------------------- |
| P1-01 | Next.js init, GitHub push, Vercel deploy                         | 2h  | Public URL works          |
| P1-02 | Supabase project + CLI + migrations folder                       | 1h  | `supabase db reset` works |
| P1-03 | Migrations 001–015 (all tables)                                  | 3h  | Clean apply               |
| P1-04 | Migration 016: RLS policies                                      | 2h  | Cross-user test passes    |
| P1-05 | Migration 017–018: indexes + helper functions                    | 1h  | Function tests pass       |
| P1-06 | `lib/pace-zones.ts` + 20+ unit tests                             | 3h  | 100% coverage             |
| P1-07 | `lib/plan-validators.ts` + 15+ tests                             | 3h  | 6 rule classes            |
| P1-08 | `lib/checkpoint-logic.ts` + tests                                | 2h  | Boundary tests            |
| P1-09 | Zod schemas (WizardInput, GeneratedPlan, RunInput, CheckinInput) | 2h  | Round-trip tests          |
| P1-10 | Supabase auth + middleware                                       | 3h  | Magic link works          |
| P1-11 | Signup with invite code (atomic)                                 | 3h  | Concurrent test passes    |
| P1-12 | Admin role + `/admin` guard + seed                               | 1h  | Non-admin → 403           |
| P1-13 | CI: GitHub Actions (lint + typecheck + tests)                    | 2h  | PR blocked on fail        |
| P1-14 | Initialize `/docs/` control documents                            | 1h  | All committed             |

**Exit criteria:**

- [ ] All migrations apply on clean DB
- [ ] RLS verified (A can't read B)
- [ ] 100% test coverage on `pace-zones.ts`, `plan-validators.ts`, `checkpoint-logic.ts`
- [ ] Invite signup works; concurrent single-use prevented
- [ ] Admin route blocked for non-admin
- [ ] CI green on `main`
- [ ] TS strict, zero `any`
- [ ] No `console.log` in source

## Phase 2 — Feature Integration (Days 8–15)

| ID    | Task                                              |
| ----- | ------------------------------------------------- |
| P2-01 | Wizard UI (7 steps, conditional branching)        |
| P2-02 | System prompt (~3000 tokens, methodology encoded) |
| P2-03 | Anthropic SDK integration + retry logic           |
| P2-04 | Plan validation pipeline (Zod + math)             |
| P2-05 | DB write txn (plan + version + sessions)          |
| P2-06 | `/onboarding/review` screen                       |
| P2-07 | Plan calendar view (`/plan`)                      |
| P2-08 | Session detail page                               |
| P2-09 | Manual run logging                                |
| P2-10 | Daily check-in form                               |
| P2-11 | Checkpoints UI                                    |
| P2-12 | Niggle log UI                                     |
| P2-13 | Dashboard with trends                             |
| P2-14 | Settings (profile, data export)                   |

**Exit:** E2E happy path — signup → wizard → plan → log run → dashboard updates.

## Phase 3 — Hardening (Days 16–22)

| ID    | Task                                              |
| ----- | ------------------------------------------------- |
| P3-01 | Upstash rate limiting on all auth/AI endpoints    |
| P3-02 | RLS audit script (automated cross-user test)      |
| P3-03 | AI cost caps (lifetime + daily + monthly)         |
| P3-04 | Adjustment rules engine (6 rules, pure functions) |
| P3-05 | Nightly cron `/api/cron/adjustments`              |
| P3-06 | Audit log writes on sensitive actions             |
| P3-07 | Sentry error tracking                             |
| P3-08 | Coach sharing (invites, view, comments)           |
| P3-09 | Admin console (invites, users, AI usage)          |
| P3-10 | Error boundaries + empty states + skeletons       |

## Phase 4 — Validation & Release (Days 23–27)

| ID    | Task                                                          |
| ----- | ------------------------------------------------------------- |
| P4-01 | E2E tests (Playwright) for happy path                         |
| P4-02 | Edge cases: timezones, leap years, missed cron, regen quota   |
| P4-03 | Load test AI endpoint (concurrent generations)                |
| P4-04 | PDF export (`@react-pdf/renderer`)                            |
| P4-05 | Mobile responsiveness sweep                                   |
| P4-06 | Dark mode                                                     |
| P4-07 | Runbook: incident response, key rotation, restore from backup |
| P4-08 | Production deploy + first invite codes                        |

## Phase 5 — Strava (Days 28–30, optional v1)

OAuth + webhook + activity → run mapping + dedup + auto-match.

## Phase 6 — Garmin (post-approval, 2 days)

OAuth 1.0a + cron polling + dedup with Strava.

---

## CCTV Daily Cycle

Each working day:

1. **Audit** ([CLAUDE CODE - SONNET 4.6]) — scan repo, produce CCTV Audit Report
2. **Plan** ([CLAUDE WEB - OPUS 4.7]) — review audit, update control docs, issue Daily Execution Prompt
3. **Execute** ([CLAUDE CODE - SONNET 4.6]) — implement exactly as prompted, in ≤2h increments
4. **Validate & Commit** — explicit confirmation gate before merge

## Risks

| Risk                                 | Mitigation                                              |
| ------------------------------------ | ------------------------------------------------------- |
| AI generates bad plan                | Zod + math validators, retry, manual review of first 10 |
| Anthropic outage                     | Queue + retry, email user when done                     |
| Cost runaway                         | Hard caps + admin alerts                                |
| Garmin API approval slow             | Strava-first (Apple Watch covered via Strava sync)      |
| Claude Code regenerates working code | Small commits, CCTV audit catches drift                 |
| Scope creep                          | DEVIATIONS.md tracks every drift; weekly recalibration  |
