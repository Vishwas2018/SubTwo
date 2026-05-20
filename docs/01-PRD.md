# Product Requirements Document
## SubTwo — AI Running Coach Platform

**Version:** 1.0 (final)
**Status:** Approved baseline

---

## 1. Vision

A web platform where any runner can generate a personalised, AI-coached training plan for any race distance, then execute it with auto-imported workout data, checkpoint testing, and adaptive rule-based adjustments. Optional coach/friend sharing.

## 2. Users

| Persona | Description |
|---|---|
| **Athlete** | Any runner with a valid invite code |
| **Coach/Friend** | Invited viewer, read-only + comments |
| **Admin** | Generates invite codes, monitors usage (initial admin: jvishu21@gmail.com) |

## 3. Core Features

### 3.1 Invite-gated signup
- Signup requires valid 8-char invite code
- Admin generates single-use or multi-use codes with caps + expiry
- Rate limited: 5 attempts/hour/IP

### 3.2 Plan generation wizard (adaptive)
7 steps, branches on experience level:
1. Race basics: distance (any km), date, name
2. Experience: beginner / intermediate / advanced
3. Current fitness (questions branch on level)
4. Goal time (optional — AI suggests if blank)
5. Constraints: days/week, long-run day, injuries
6. Equipment/fueling (optional)
7. Review generated plan

### 3.3 AI plan generation
- Claude Sonnet 4 via Anthropic API
- Server-side only; API key never exposed
- Structured JSON output, Zod-validated
- Quotas: 3/24h, 10 lifetime per user
- Failed generations don't count toward quota
- Cost: ~$0.10/plan

### 3.4 Plan execution
- Plan calendar view, session detail pages
- Run logging: manual + Strava (Phase 6) + Garmin (Phase 10)
- Daily check-ins: sleep, RHR, weight, energy, mood, niggle flag
- Niggle tracking with severity, body part, resolution
- Checkpoints with green/amber/red verdicts (dynamic, set by AI)

### 3.5 Adaptive adjustments (rule-based, no AI)
Nightly cron runs 6 rule checks:
| Trigger | Action |
|---|---|
| 2+ missed key sessions/week | Next week → deload |
| RHR +5bpm × 3 days | Deload next quality session |
| Niggle 5+ days | Suggest cross-train swap |
| Easy pace consistently <7s/km of threshold | Enforce easy pace alert |
| Sleep <7h × 3 days | Reduce next quality intensity |
| Checkpoint red | Offer AI regen for remaining weeks |

All adjustments reversible. Adjustment log in `plan_adjustments` table.

### 3.6 Dashboard
- Today's session + week progress
- 4-week trends: volume, easy pace, sleep, RHR
- Sub-goal readiness gauge based on checkpoints
- Alerts (easy pace creep, sleep deficit, persistent niggle)

### 3.7 Coach sharing
- Email invite, magic-link signup
- Read-only access + optional comments
- Single-line comments on any session/run
- Revoke anytime

### 3.8 Admin console
- Invite code generation/management
- User list with plan status
- AI usage/cost dashboard

## 4. Success Criteria

- Wizard → generated plan in <90s
- 80%+ users accept first generation
- AI cost <$0.15/user
- Zero pace-math errors (100% test coverage on `pace-zones.ts`)
- All adjustment rules deterministic + tested

## 5. Out of Scope (v1)

- Public plan sharing / templates marketplace
- Multi-language
- Manual plan editor (regen only)
- Strength plan generation
- AI weekly coaching commentary
- Mobile native app
- Email/push reminders
- Nutrition macro tracking

## 6. Constraints

- Anthropic API: ~$0.10/plan, hard caps enforced
- Free Supabase tier: ~2000 active users before paid
- Free Vercel tier: ample for personal/small group
- Garmin API: requires approval (1–4 weeks); Strava first

## 7. Approved Decisions

| Topic | Decision |
|---|---|
| Platform | Web only |
| Signup | Invite code required |
| Race distance | User-defined (any km) |
| AI model | Claude Sonnet 4 |
| Wizard | Branches by experience level |
| Plan privacy | Private only |
| Coach comments | Single-line, one coach per athlete |
| Custom domain | No (Vercel subdomain) |
| Data hosting | US (Supabase + Vercel cloud) |
| PDF export | Yes, end of program |
