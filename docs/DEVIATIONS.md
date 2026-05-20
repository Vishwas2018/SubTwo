# DEVIATIONS

## SubTwo — Architecture/Spec Drift Log

**Owner:** [CLAUDE WEB - OPUS 4.7]

---

Track every drift from baseline specs (`01-PRD.md` through `07-Implementation-Roadmap.md`). Don't delete entries; mark resolved or accepted.

## Status legend

🔴 unresolved · 🟡 under review · 🟢 resolved · ⚪ accepted as new baseline

---

## Open

## DEV-001 | Next.js 16 instead of 15

- Detected: Day 1 by Code during scaffold
- Baseline doc: 02-Architecture.md §1 (Frontend row)
- Actual: create-next-app@latest installed Next.js 16.2.6
- Impact: None — App Router API surface unchanged; all spec features supported
- Resolution: accept-as-baseline
- Status: ⚪

## DEV-002 | `next lint` swapped for `eslint .`

- Detected: Day 1 by Code
- Baseline doc: implied by Next.js convention
- Actual: `next lint` CLI broken in Next.js 16 (directory parsing bug); using `eslint .` directly
- Impact: None functional; lint script behavior identical
- Resolution: accept-as-baseline (revisit if Next.js patches)
- Status: ⚪

---

## Resolved / Accepted

_None._

---

## Template

```
## DEV-XXX | <title>
- Detected: Day X by <role>
- Baseline doc: <file & section>
- Actual: <what was built/changed>
- Impact: <scope/risk>
- Resolution: revert / accept-as-baseline / re-plan
- Status: 🔴/🟡/🟢/⚪
```
