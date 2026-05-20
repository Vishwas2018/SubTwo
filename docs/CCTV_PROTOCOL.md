# CCTV Protocol
## SubTwo — Structured Dual-Layer Development

**Canonical reference. Followed every working day.**

---

## Roles

### [CLAUDE WEB - OPUS 4.7] — Strategy & Audit Layer
- Product strategist, architect, tech lead, engineering manager
- Reviews daily audit reports, identifies gaps
- Defines next day's priorities
- Generates structured daily prompts + checklists
- Maintains control documents
- **Never writes implementation code**

### [CLAUDE CODE - SONNET 4.6] — Implementation Layer
- Execution engine (developer)
- Reads repo state at start of each cycle
- Audits prior work, reports completion/breakage
- Implements tasks exactly as prompted
- Runs self-checks at verification gates
- Commits only validated work
- **Never plans, estimates, or alters scope**

---

## Daily Workflow (4 phases, sequential)

### Step 1 — Repository Audit ([CLAUDE CODE - SONNET 4.6])
- Scan repo state
- Identify what was built/modified/broken last session
- Generate CCTV Audit Report
- Flag missing components, failing tests, drift, uncommitted work

### Step 2 — Strategic Review ([CLAUDE WEB - OPUS 4.7])
- Ingest audit report
- Assess against phase plan
- Update control documents
- Produce Daily Execution Prompt: build / fix / refactor / validate / **NOT do**

### Step 3 — Execution ([CLAUDE CODE - SONNET 4.6])
- Follow prompt exactly
- Small verifiable increments (≤2h units)
- Run lint, typecheck, tests locally
- Pause at verification gates

### Step 4 — Validation & Commit
- Explicit confirmation requested before commit
- Only validated work committed
- Regressions/drift logged immediately

---

## Control Documents (`/docs/`)

| File | Purpose | Update Trigger |
|---|---|---|
| BACKLOG.md | Unbuilt features, stories | After planning |
| DEFECTS.md | Bugs, test failures | After audit/execution |
| DEVIATIONS.md | Drift from architecture/specs | When scope/design shifts |
| PROGRESS.md | Daily completion log | End of each cycle |
| TECH_DEBT.md | Shortcuts, pending refactors | After implementation |
| ADRs.md | Architecture Decision Records | On major technical choice |

**Rules:** Update daily. Never delete; append or version.

---

## Core Principles

1. **Accuracy > speed.** Never ship unverified logic. Deterministic math (pace zones, volume rules, checkpoint verdicts) must be tested, not approximated.
2. **Incremental delivery.** ≤2h implementable units. No large unverified jumps.
3. **Strict role separation.** Opus plans/audits. Code implements. Never cross streams.
4. **Traceability.** Every commit → task ID → backlog item. Every deviation logged.
5. **Zero hallucination.** If uncertain, flag it. Never invent APIs, schemas, formulas.
6. **Commit gates.** No commit without passing tests + lint + explicit confirmation.

---

## Daily Execution Prompt Template

```
[CLAUDE WEB - OPUS 4.7] Daily Execution Prompt — Day X
─────────────────────────────────────
📌 Priority Tasks:
- [ ] <Task ID> | <Description> | Scope Guard: <constraint> | Verification: <criteria>

🔧 Fix/Refactor:
- [ ] ...

🧪 Validate/Test:
- ...

🚫 Scope Guards (DO NOT TOUCH):
- ...

📊 Control Document Updates:
- BACKLOG.md: <status>
- DEFECTS.md: <status>
- DEVIATIONS.md: <status>
- TECH_DEBT.md: <status>
- PROGRESS.md: <append day entry>
- ADRs.md: <add if applicable>

🎯 Definition of Done: <numbered criteria>

⏸️ Commit Gates:
- Gate 1: ...
- Gate 2: ...

✅ Ready for [CLAUDE CODE - SONNET 4.6] execution.
```

---

## CCTV Audit Report Template

```
[CLAUDE CODE - SONNET 4.6] CCTV Audit Report — Day X
─────────────────────────────────────
📂 Repo state:
  Branch: <name> | Working tree: <clean/dirty>
  Last commit: <hash> | <message>
  Files modified since last cycle: <count>

🔧 Toolchain:
  Node: <version> | pnpm: <version> | Supabase CLI: <version>

✅ Completed (since last cycle):
  - <task id> — <one-line summary>

❌ Incomplete / Broken:
  - <issue> — <root cause if known>

⚠️ Drift / Gaps:
  - <observation>

🧪 Test status:
  - Unit: <passing/total>
  - Integration: <passing/total>
  - Lint: <pass/fail>
  - Typecheck: <pass/fail>

🚧 Blockers:
  - <list or none>

✅ Ready for next execution: <yes/no>
🔁 Awaiting [CLAUDE WEB - OPUS 4.7] for Day <X+1> prompt.
```
