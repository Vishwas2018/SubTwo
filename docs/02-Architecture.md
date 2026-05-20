# Architecture
## SubTwo

**Version:** 1.0 (final)

---

## 1. Stack

| Layer | Technology | Why |
|---|---|---|
| Frontend | Next.js 15 (App Router) + React 19 + TypeScript | SSR/RSC, type safety |
| Styling | Tailwind CSS + shadcn/ui | Fast UI, accessible defaults |
| Backend | Next.js API routes (serverless) | Single codebase |
| Database | Supabase (Postgres) | Free tier, built-in auth, RLS |
| Auth | Supabase Auth (magic link) | No passwords |
| Storage | Supabase Storage | Future avatars/exports |
| AI | Anthropic Claude Sonnet 4 | Plan generation |
| Hosting | Vercel | Auto-deploy from GitHub |
| Cron | Vercel Cron | Nightly adjustments, Garmin sync |
| Email | Resend | Coach invites, notifications |
| Source | GitHub (Vishwas2018/SubTwo) | |
| Monitoring | Vercel Analytics + Sentry (free) | Errors, uptime |
| Package mgr | pnpm | |

**Region:** Supabase `ap-southeast-2` (Sydney) for AU latency.

## 2. System Diagram

```
BROWSER (athlete/coach/admin)
    │ HTTPS
    ▼
VERCEL EDGE
  ├─ Next.js (Pages + API + Cron)
  │
  ├──> Supabase (Postgres + Auth + Storage + RLS)
  ├──> Anthropic API (plan generation)
  ├──> Strava API (OAuth + webhooks)
  ├──> Garmin API (OAuth + polling)
  └──> Resend (email)
```

## 3. Key Architectural Decisions

| # | Decision | Rationale |
|---|---|---|
| ADR-001 | Next.js App Router | Server Components, less client JS |
| ADR-002 | Supabase over Firebase | Postgres + RLS for coach sharing |
| ADR-003 | Monolith, no separate API | Single codebase, serverless scales |
| ADR-004 | Plan stored as data, not code | Per-user, AI-generated |
| ADR-005 | Strava webhook + Garmin polling | Strava pushes; Garmin doesn't |
| ADR-006 | Sonnet 4 (not Haiku) | Plan quality > $0.08 savings |
| ADR-007 | Invite-gated signup | Cost control + curation |
| ADR-008 | Rule-based adjustments (not AI) | Deterministic, free, testable |

## 4. Folder Structure

```
SubTwo/
├── app/
│   ├── (auth)/login, signup
│   ├── (app)/dashboard, plan, session/[id], log, check-in, checkpoints, history, niggles, settings
│   ├── (coach)/coach/[athleteId]
│   ├── (admin)/admin/{invites,users,ai-usage}
│   ├── onboarding/wizard/[step], onboarding/review
│   └── api/{auth,plans,runs,checkins,checkpoints,niggles,invites,integrations,webhooks,cron,admin,export}/
├── components/{ui,dashboard,plan,session,wizard,admin,shared}/
├── lib/
│   ├── supabase/{client,server,middleware}.ts
│   ├── ai/{anthropic-client,prompt-builder,plan-schema}.ts
│   ├── integrations/{strava,garmin}.ts
│   ├── pace-zones.ts          # Deterministic math
│   ├── plan-validators.ts     # 10% rule, deload cadence
│   ├── checkpoint-logic.ts    # Verdict computation
│   ├── adjustment-rules.ts    # 6 rule checks
│   └── utils.ts
├── types/database.types.ts    # Generated from Supabase
├── supabase/
│   ├── migrations/
│   └── seed.sql
├── docs/                       # Spec + control documents
├── reference/                  # Example training plan
├── tests/{unit,integration,e2e}/
├── middleware.ts
└── package.json
```

## 5. Data Flow Examples

**Plan generation:**
```
Wizard → POST /api/plans/generate
  → validate invite + quota
  → build prompt
  → Anthropic API call
  → Zod validate response
  → math validators (10% rule, deload)
  → insert plan + plan_version + planned_sessions (txn)
  → log ai_generations row
  → return to client
```

**Strava webhook:**
```
Strava → POST /api/webhooks/strava
  → verify HMAC signature
  → fetch full activity from Strava API
  → upsert runs row (dedup on source+external_id)
  → auto-match to planned_session by date
  → 200 OK within 2s
```

**Nightly adjustment cron:**
```
Vercel Cron → POST /api/cron/adjustments
  → for each active plan:
    → run 6 rule checks
    → if trigger fires: modify upcoming sessions, log plan_adjustments
```

## 6. Security Summary

- All tables RLS-enabled, scoped to `auth.uid()`
- Coach access via `viewer_access` table + policy
- Admin via `profiles.is_admin` flag
- OAuth tokens encrypted (Supabase Vault)
- Webhook signatures verified
- AI prompt injection: delimited input tags + output validation
- Rate limits: 100/min reads, 30/min writes, 3/24h AI gen

## 7. Cost Projection

| Users | Monthly cost |
|---|---|
| 1 (you) | ~$0.10–0.50 (Anthropic) |
| 5 friends | ~$2–5 |
| 50 | ~$20–40 |
| 500 | ~$150–300 (revisit pricing) |

Vercel + Supabase + Resend stay free at this scale.

## 8. Env Vars

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_APP_URL=
SUPABASE_SERVICE_ROLE_KEY=
ANTHROPIC_API_KEY=
ANTHROPIC_MODEL=claude-sonnet-4
AI_GENERATION_LIFETIME_CAP=10
AI_GENERATION_DAILY_CAP=3
AI_MONTHLY_SOFT_CAP_USD=50
AI_MONTHLY_HARD_CAP_USD=100
STRAVA_CLIENT_ID=
STRAVA_CLIENT_SECRET=
STRAVA_WEBHOOK_VERIFY_TOKEN=
GARMIN_CONSUMER_KEY=
GARMIN_CONSUMER_SECRET=
RESEND_API_KEY=
CRON_SECRET=
INITIAL_ADMIN_EMAIL=jvishu21@gmail.com
```

## 9. Deploy Pipeline

```
local → git push → GitHub → Vercel auto-deploy
                                ↓
                          Preview deploys on PRs
```

- Production: push to `main`
- Migrations: Supabase CLI, committed to repo
- Rollback: one-click in Vercel
