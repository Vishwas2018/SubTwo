# MindMosaic — Production-Readiness Audit & UI Polish (Claude Code)

## Role & Mode
You are performing a **final pre-release audit** of this application as if it were a premium,
customer-facing SaaS product. Operate in **read-only audit mode**: investigate, test, and log
findings. **Do not change code, run migrations against prod, or commit anything** during this pass.
The deliverable is a prioritized report, not fixes.

---

## Step 0 — Ground yourself in the repo (do this first)
Before auditing anything, build an accurate mental model of the project:
1. Read `CLAUDE.md`, `.claude/settings.json`, and any README / setup docs.
2. Map the codebase: routes/pages, components, Supabase Edge Functions
   (`create-session`, `respond`, `submit`) and their shared modules, SQL migrations, and
   the RLS-scoped tables.
3. Detect the stack and how to run it locally — inspect `package.json`, Supabase config, and
   env templates. Identify the dev-server command and whether `supabase start` / local DB is available.
4. Determine what testing tooling exists: linter, type-checker, unit/integration tests, and whether
   a **browser automation tool (e.g. Playwright/Puppeteer MCP)** is connected.
   - If browser tooling **is** available → drive real end-to-end flows through it.
   - If it is **not** → do a thorough code-level + running-app audit, and produce a **manual-test
     checklist** I can execute myself. Do **not** invent visual findings you cannot actually observe.

Report back a one-paragraph "environment summary" (stack, how to run, tooling found) before starting Phase 1.

---

## Credentials (handle safely — non-negotiable)
- A test login may be needed. **Read it only from environment variables**
  `TEST_USER_EMAIL` / `TEST_USER_PASSWORD`. Reference the account everywhere as **`[TEST_USER]`**.
- **Never** echo, log, print, or write credentials into the report or any file. If the env vars are
  not set, pause and ask me — do not hardcode a fallback.
- Use only local/staging targets. Treat any provided account as **staging-only**.

---

## Guardrails
- **Read-only:** no edits, no commits, no schema changes. Log findings; I'll remediate separately.
- **No production:** never call live APIs or touch real tenant data. Mock all external services.
- **Use existing seed data only** (e.g. tenant `a0000000-…001`, student `b0000000-…002`,
  parent `b0000000-…001`, etc.). Never operate against real/unknown tenant IDs.
- **Escalate immediately:** the moment you find a **Critical** or **High** issue (data loss, security
  hole, broken core flow), stop and surface it before continuing.
- Every finding must be **reproducible, actionable, and mapped to a file/route/function**.

---

## Audit Scope

**Phase 1 — Inventory & setup**
Confirm the app runs locally, seed/verify mock data, enumerate routes + components + edge-function
endpoints, and confirm `[TEST_USER]` can authenticate against staging/local.

**Phase 2 — UI/UX visual audit**
Review key screens at three breakpoints — mobile (<768px), tablet (768–1024px), desktop (>1024px).
Check layout consistency, spacing, typography hierarchy, color contrast (WCAG 2.1 AA), and all
interactive/edge states (hover, focus, active, disabled, loading, empty, error, skeleton, offline).
Reference design-system tokens where they exist.

**Phase 3 — Functional & E2E**
Walk the core journeys end to end with `[TEST_USER]`: onboarding → auth → dashboard → key workflow
→ completion. Validate form handling (validation, submission, error recovery, success feedback),
data flow (API calls, state, persistence, cache), and edge cases (network failure, invalid input,
session expiry, concurrent actions, idempotency on the edge functions).

**Phase 4 — Stability, performance, config**
Capture console errors and unhandled rejections during flows. Check for broken links / 404s /
dead-ends / inconsistent nav. Note Core Web Vitals where measurable (**LCP, INP, CLS**) and bundle-size
warnings. Verify accessibility basics (keyboard nav, ARIA labels, screen-reader landmarks). Confirm
analytics/error-tracking/logging hooks, env vars, and deployment config look production-ready.

**Phase 5 — Prioritize & report**
Categorize every finding by severity:
- **Critical** — blocks release, data loss, security risk
- **High** — major UX break, core feature broken
- **Medium** — noticeable bug, workaround exists
- **Low** — minor visual glitch
- **Polish** — subjective, non-blocking improvement

---

## Output
Write the full report to **`AUDIT_REPORT.md`** in the repo root **and** post a summary in chat.
Use exactly this structure:

```
E2E Validation Report — [Git SHA / Date]
────────────────────────────────────────────
PASSED (No Action Needed):
  [Feature/Flow] | [Brief confirmation]

POLISH NEEDED (Low Priority):
  [Component/Screen] | [Issue] | [Suggested fix]

DEFECTS (Action Required):
  [ID] [Severity] | [Description]
    • Steps:     [Repro steps]
    • Expected:  [What should happen]
    • Actual:    [What actually happens]
    • Component: [File / Route / Function]

PERFORMANCE / STABILITY:
  [Metric/Observation] | [Impact] | [Recommendation]

SECURITY / CONFIG CHECKS:
  [Item] | [Pass/Fail] | [Notes]

PRIORITIZED NEXT ACTIONS:
  [Task] | [Effort: S/M/L] | [Blocker: Y/N] | [Owner hint]
```

---

## Start
Reply with: **`[AUDIT] Ready.`** Then give me the environment summary from Step 0 and confirm:
target environment (local/staging), the journeys you'll prioritize, and any known concern areas you
spotted while mapping the repo. Begin Phase 1 once I confirm — no need to wait if the environment is
already running and `TEST_USER_*` env vars are present.
