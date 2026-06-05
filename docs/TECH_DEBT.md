# TECH_DEBT

## SubTwo — Technical Debt Register

**Owner:** [CLAUDE CODE - SONNET 4.6] logs → [CLAUDE WEB - OPUS 4.7] prioritises

---

## Status: 🔴 outstanding · 🟡 scheduled · 🟢 paid

---

## Outstanding

| ID     | Item                                                       | Severity | Reason                                                                   | Repay by                                            |
| ------ | ---------------------------------------------------------- | -------- | ------------------------------------------------------------------------ | --------------------------------------------------- |
| TD-001 | Garmin integration deferred                                | Medium   | API approval lead time (1–4 wks)                                         | Phase 6                                             |
| TD-002 | PDF export deferred                                        | Low      | Not blocking MVP                                                         | Phase 5                                             |
| TD-003 | Adjustment notifications in-app only (no email)            | Low      | Email infra simpler later                                                | Phase 3+                                            |
| TD-004 | No Apple Health support                                    | Low      | Web API not available; Strava covers via sync                            | Permanent                                           |
| TD-005 | Single coach per athlete                                   | Low      | Simpler v1 model                                                         | v2                                                  |
| TD-006 | No public plan sharing                                     | Low      | Privacy default                                                          | v2                                                  |
| TD-007 | Vercel CLI TLS workaround (NODE_OPTIONS='--use-system-ca') | Low      | Corporate cert chain not in Node bundle                                  | Document in runbook; consider removing post-Phase 4 |
| TD-008 | OAuth tokens stored as plain TEXT, not encrypted           | Medium   | Supabase Vault requires Phase 3 setup; no integrations active in Phase 1 | Phase 3 (before P5-01 Strava OAuth)                 |
| TD-010 | ai-live.test.ts hangs in vitest worker (corporate proxy; `--use-system-ca` not inherited by worker subprocess); live gate via `scripts/live-test.ts` | Low | CA not in Node bundle; CI unaffected (API key absent → skip); env-only limitation | ⚪ WONTFIX — corporate proxy; gate proven via scripts/live-test.ts |
| TD-012 | CSP uses 'unsafe-inline' (weakens XSS protection) | Medium | Nonce infra requires proxy/middleware refactor, forces dynamic rendering | Before public launch |
| TD-019 | Qwen (qwen-turbo via DashScope intl) requires Vercel Pro for reliable sub-60s generation | Medium | DashScope intl endpoint latency from Vercel syd1 spikes to >60s; capped output tokens at 4096 as mitigation; structural fix is Vercel Pro (longer function timeout) or swap to Groq-hosted Qwen model | Before enabling Qwen in production marketing |
| TD-020 | Groq hidden from beta wizard dropdown due to free-tier upstream instability | Medium | llama-3.3-70b-versatile on Groq free tier stalls unpredictably, causing Vercel 504s; adapter + GROQ_API_KEY intact; re-enable `PROVIDER_OPTIONS` entry in `app/onboarding/wizard/page.tsx` when Groq free-tier reliability improves | Post-beta when Groq confirms stable throughput |
---

## Paid

| ID     | Item                                                       | Severity | Paid by                                                                  |
| ------ | ---------------------------------------------------------- | -------- | ------------------------------------------------------------------------ |
| TD-009 | In-memory rate limit (lost on cold start, not multi-region) | Medium | Day 17 — Upstash sliding-window limiters on all auth/AI/write/export endpoints; memory.ts kept as fallback when UPSTASH_* absent |
| TD-011 | Single-call plan generation; batch architecture needed for plans >20 weeks (token budget exceeded, requires 2-3 retries) | High | Day 16 (commit b67067e) — two-phase batch generation; routing ≤12wk single / >12wk batch; live-verified 19-week plan |
| TD-013 | 2 cron integration tests skipped (need BASE_URL env in test) | Low | Day 23 — replaced HTTP tests with direct handler unit tests in `tests/unit/cron/cron-auth.test.ts`; 3 unit tests run in CI without a live server; HTTP integration tests remain skipped (Vercel env vars unset) |
| TD-014 | Vercel deployment missing all env vars — app returned 500 for all requests | High | Day 25 — 6 boot-required vars set in Vercel dashboard; prod smoke `/ + /login → 200`; cron auth: `401 without secret, 200 with` ✓ |
| TD-015 | `SONNET_PRICING` constant used for cost logging regardless of model; incorrect for Haiku | Low | Beta QA Day — renamed to `CLAUDE_PRICING`, updated to Haiku 4.5 rates ($0.80/$4 per MTok); `SONNET_PRICING` kept as alias |

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
