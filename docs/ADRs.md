# ADRs
## SubTwo — Architecture Decision Records

**Owner:** [CLAUDE WEB - OPUS 4.7]

---

## ADR-001 | Next.js 15 App Router
- **Date:** Day 0
- **Status:** Accepted
- **Context:** Need React framework with SSR, API routes, deployable to Vercel
- **Decision:** Next.js 15 App Router (not Pages Router)
- **Consequences:** Server Components reduce client bundle. Less mature ecosystem than Pages. Claude Code generates better App Router code.

## ADR-002 | Supabase over Firebase
- **Status:** Accepted
- **Context:** Need DB + auth + storage + sharing permissions
- **Decision:** Supabase (Postgres + RLS)
- **Consequences:** Relational fits training data. RLS handles coach sharing natively. Postgres exportable if we leave. Less real-time tooling than Firebase.

## ADR-003 | Monolith (no separate API server)
- **Status:** Accepted
- **Context:** Single developer, simple ops
- **Decision:** Next.js API routes only
- **Consequences:** One codebase. Vercel scales serverless. No CORS. If we need long-running jobs, must use Vercel Background Functions.

## ADR-004 | Plan stored as data, not code
- **Status:** Accepted
- **Context:** Pivoted from hardcoded sub-2 plan to AI-generated per-user plans
- **Decision:** Plans in `plans` + `plan_versions` + `planned_sessions` tables
- **Consequences:** Per-user customisation. Versioning enables rollback. Larger DB footprint (~250KB/user).

## ADR-005 | Strava webhook + Garmin polling
- **Status:** Accepted
- **Context:** Different integration models
- **Decision:** Strava pushes (webhook); Garmin polled via cron every 6h
- **Consequences:** Strava near-instant sync. Garmin lag up to 6h. Dedup needed when both connected.

## ADR-006 | Claude Sonnet 4 (not Haiku) for plan gen
- **Status:** Accepted
- **Context:** Plan quality is core differentiator
- **Decision:** Sonnet 4 (~$0.10/plan) over Haiku (~$0.02/plan)
- **Consequences:** Better periodisation, pacing logic. $0.08 extra/plan justified by quality. Can re-evaluate at scale.

## ADR-007 | Invite-gated signup
- **Status:** Accepted
- **Context:** Cost control + curated rollout
- **Decision:** Admin-generated invite codes required
- **Consequences:** Controlled growth. Manual onboarding overhead. Reversible (can open later).

## ADR-008 | Rule-based adjustments (not AI)
- **Status:** Accepted
- **Context:** Plan adaptation logic
- **Decision:** Deterministic rules in `lib/adjustment-rules.ts`, not AI calls
- **Consequences:** Free, testable, predictable. Less nuanced than AI review. Reduces ongoing AI cost. Aligns with Option 2 from product decisions.

---

## Template

```
## ADR-XXX | <title>
- Date: Day X
- Status: Proposed / Accepted / Superseded by ADR-YYY
- Context: <problem>
- Decision: <choice>
- Consequences: <trade-offs>
```
