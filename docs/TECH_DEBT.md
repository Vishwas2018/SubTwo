# TECH_DEBT
## SubTwo — Technical Debt Register

**Owner:** [CLAUDE CODE - SONNET 4.6] logs → [CLAUDE WEB - OPUS 4.7] prioritises

---

## Status: 🔴 outstanding · 🟡 scheduled · 🟢 paid

---

## Outstanding

| ID | Item | Severity | Reason | Repay by |
|---|---|---|---|---|
| TD-001 | Garmin integration deferred | Medium | API approval lead time (1–4 wks) | Phase 6 |
| TD-002 | PDF export deferred | Low | Not blocking MVP | Phase 4 (P4-04) |
| TD-003 | Adjustment notifications in-app only (no email) | Low | Email infra simpler later | Phase 3+ |
| TD-004 | No Apple Health support | Low | Web API not available; Strava covers via sync | Permanent |
| TD-005 | Single coach per athlete | Low | Simpler v1 model | v2 |
| TD-006 | No public plan sharing | Low | Privacy default | v2 |

---

## Paid

_None._

---

## Template

```
## TD-XXX | <item>
- Severity: low/medium/high
- Origin: Day X / commit <hash>
- Reason for shortcut: <rationale>
- Repay by: <phase / never>
- Risk if unpaid: <impact>
- Status: 🔴/🟡/🟢
```
