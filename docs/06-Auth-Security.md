# Auth & Security

## SubTwo

**Version:** 1.0 (final)

---

## 1. Authentication

**Method:** Supabase Auth — Email Magic Link

- No passwords stored
- Session: HTTP-only, secure, sameSite=Lax cookie, 7-day expiry
- Logout invalidates server session + clears cookie

**Signup flow:**

1. POST /api/auth/signup with `email` + `invite_code`
2. Server validates invite atomically (exists, not expired, under cap → increment)
3. Supabase sends magic link
4. Click → JWT issued → DB triggers insert profile + audit log
5. Redirect /onboarding/wizard

**Login flow:**

1. POST /api/auth/login with email
2. Magic link → click → JWT → /dashboard

**Coach login:** Same as athlete. Single account can be both athlete + coach (linked via `viewer_access`).

## 2. Invite Code Validation

| Property       | Implementation                                       |
| -------------- | ---------------------------------------------------- |
| Format         | 8 alphanumeric, no 0/O/1/I/l                         |
| Generation     | crypto.randomBytes, admin-only                       |
| Atomicity      | `validate_invite_code()` SQL function with row lock  |
| Error messages | Generic "Invalid code" (no enumeration)              |
| Rate limit     | 5 signup attempts/hour/IP                            |
| Storage        | Plain text (low value alone), but never in URLs/logs |

## 3. Authorization

**RLS enforced at Postgres level** — frontend cannot bypass.

| Policy         | Tables                                                                                                                                | Rule                                            |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| Owner          | runs, checkins, checkpoints, niggles, plans, plan_versions, planned_sessions, plan_adjustments, niggles, integrations, ai_generations | `user_id = auth.uid()` for ALL                  |
| Viewer read    | Same set (excluding integrations, ai_generations)                                                                                     | Via `viewer_access` join                        |
| Viewer comment | run_comments                                                                                                                          | `INSERT` if `can_comment=true` in viewer_access |
| Admin          | invite_codes                                                                                                                          | `is_admin=true` for ALL                         |

**Coaches CANNOT:** modify athlete data, view other athletes (without separate invite), access integrations/tokens, invite further coaches on athlete's behalf.

## 4. Admin Role

- Granted via direct DB update (no self-service UI)
- Initial admin seeded in migration 019 with `INITIAL_ADMIN_EMAIL` env var
- Middleware guards `/admin/*` and `/api/admin/*` routes
- All admin actions logged to `audit_log`

## 5. Sensitive Data Handling

| Data                            | Storage                                              | Notes                    |
| ------------------------------- | ---------------------------------------------------- | ------------------------ |
| OAuth tokens                    | `integrations.access_token` (encrypted via pgsodium) | Never returned to client |
| Health data (HR, weight, sleep) | RLS-protected, plain                                 | Excluded from logs       |
| Email                           | profiles + viewer_access                             | Never exposed cross-user |

## 6. Anthropic API Security

| Control               | Implementation                                                                                                                              |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| API key               | Vercel env var, server-only, rotated annually                                                                                               |
| Call origin           | API routes only, never client                                                                                                               |
| Per-user lifetime cap | 10 successful generations                                                                                                                   |
| Per-user daily cap    | 3 in 24h rolling                                                                                                                            |
| Token cap             | 16,000 output max                                                                                                                           |
| Monthly soft cap      | $50 → admin email at 80%                                                                                                                    |
| Monthly hard cap      | $100 → auto-disable + alert                                                                                                                 |
| Failed gen            | No charge, no quota deduct                                                                                                                  |
| Prompt injection      | User inputs in `<user_input>` tags; system prompt instructs to ignore embedded instructions; free-text sanitised + length-capped (500 char) |
| Output validation     | Zod schema + math validators (10% rule, deload cadence, pace consistency) → reject + retry (max 2)                                          |

## 7. Webhook Security

| Webhook       | Verification                                    |
| ------------- | ----------------------------------------------- |
| Strava        | HMAC-SHA1 against `STRAVA_WEBHOOK_VERIFY_TOKEN` |
| Cron          | Bearer token (`CRON_SECRET`)                    |
| Invite accept | UUID v4 token, single-use, 7-day expiry         |

## 8. Input Validation

- All API inputs → Zod schemas before any DB write
- TypeScript strict mode + Supabase generated types end-to-end
- Free-text sanitised (strip control chars, suspicious patterns)
- Distance/time/numeric inputs range-checked

## 9. Rate Limiting

Vercel Edge Middleware + Upstash Redis (free tier).

| Endpoint class       | Limit        |
| -------------------- | ------------ |
| Authenticated reads  | 100/min/user |
| Authenticated writes | 30/min/user  |
| Signup               | 5/hour/IP    |
| Login magic link     | 5/hour/email |
| AI plan gen          | 3/24h/user   |
| Invites              | 5/day/user   |
| Export               | 1/hour/user  |

## 10. CSRF/XSS/SQLi

| Threat        | Defence                                                     |
| ------------- | ----------------------------------------------------------- |
| CSRF          | sameSite=Lax cookies + Origin header check on writes        |
| XSS           | React auto-escape, CSP header, no `dangerouslySetInnerHTML` |
| SQL injection | Supabase parameterised queries only                         |
| Open redirect | Allowlist post-login URLs                                   |
| Clickjacking  | `X-Frame-Options: DENY`                                     |

## 11. Transport

- Vercel auto-SSL (Let's Encrypt)
- HSTS: `max-age=31536000; includeSubDomains`
- All cookies `secure`
- No HTTP fallback

## 12. Logging

| Tool              | Purpose                                                              |
| ----------------- | -------------------------------------------------------------------- |
| Vercel Logs       | Requests, errors                                                     |
| Sentry (free)     | Exceptions                                                           |
| Supabase Logs     | DB queries, auth                                                     |
| `audit_log` table | Sensitive actions (invites, token refresh, deletions, admin actions) |

**PII rules:** no emails, names, HR, weight in logs. UUIDs OK. Stack traces scrubbed.

## 13. Data Retention

| Data                                      | Retention     | On account delete             |
| ----------------------------------------- | ------------- | ----------------------------- |
| Profile/runs/checkins/checkpoints/niggles | Indefinite    | Hard delete                   |
| OAuth tokens                              | Until revoked | Revoke upstream + hard delete |
| Audit log                                 | 2 years       | Anonymise (drop PII)          |
| Email logs (Resend)                       | 30 days       | Auto-purge                    |

Self-service: export (`/api/export`), delete account (Settings → Data, double confirm).

## 14. Backup & Recovery

- Supabase: 7-day automated backups (free tier)
- Code: GitHub history
- Manual: `/api/export` JSON dump

## 15. Threat Model

| Threat                         | Likelihood         | Mitigation                             |
| ------------------------------ | ------------------ | -------------------------------------- |
| Cross-user data access         | Low                | RLS                                    |
| OAuth token leak via DB breach | Very low           | Encryption at rest                     |
| Coach access forgotten         | Medium             | Visible + revocable in settings        |
| Webhook spoofing               | Low                | HMAC verification                      |
| Account takeover               | Medium (user-side) | Magic link, short JWT                  |
| Privilege escalation to admin  | Very low           | DB-only grant                          |
| Anthropic key leak             | Low                | Server-only, rotation, audit           |
| Prompt injection               | Medium             | Delimiters + validation + sanitisation |
| Cost runaway                   | Medium             | Hard caps + alerts                     |
| Invite code enumeration        | Low                | Generic errors, rate limit             |

## 16. Compliance Posture

- **GDPR-adjacent:** export, deletion, no third-party sharing
- **Australian Privacy Principles:** notice on signup, secure storage
- **Not HIPAA:** training data ≠ medical data
- **No tracking:** no analytics cookies, no ad networks

## 17. Incident Response

| Incident                   | Action                                                        |
| -------------------------- | ------------------------------------------------------------- |
| OAuth secret leak          | Rotate in provider + Vercel within 1h, revoke all user tokens |
| DB credential leak         | Rotate service role key, audit logs                           |
| Unauthorised access report | Force token refresh, audit `audit_log`, notify if confirmed   |
| Webhook abuse              | Tighten signature, IP allowlist                               |
| Anthropic key leak         | Immediate rotation, cost review                               |
| Data breach (confirmed)    | Notify affected users within 72h, post-mortem                 |
