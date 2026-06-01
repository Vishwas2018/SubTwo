# SubTwo — Progress Log

---

## 2026-06-01 · Beta Auth Unblock (email+password)

### Goal
Bypass SMTP dependency for beta testers. Admins create accounts with passwords; testers log in without email round-trip.

### Completed

| # | Item | Status |
|---|------|--------|
| 1 | Supabase Auth: enable Password provider alongside magic link | ⚠️ Manual — do in Supabase dashboard |
| 2 | `/api/auth/signup` — accept `{ email, password, invite_code }`, call `admin.createUser({ email_confirm: true })` | ✅ |
| 3 | `/signup` UI — password + confirm-password fields with show/hide toggle | ✅ |
| 4 | `/login` UI — password field + `signInWithPassword`; magic link behind `NEXT_PUBLIC_AUTH_MAGIC_LINK_ENABLED=true` | ✅ |
| 5 | `scripts/create-beta-users.ts` — bulk-create from `docs/BETA_USERS.csv`, writes `docs/BETA_CREDS.md` | ✅ |
| 6 | `tests/e2e/auth.setup.ts` — uses `E2E_USER_PASSWORD` for password sign-in; magic link retained as fallback | ✅ |
| 7 | `tests/e2e/smoke.spec.ts` — updated for new login/signup UI text | ✅ |
| 8 | `tests/unit/auth/password-validation.test.ts` — 9 unit tests for password + invite combined | ✅ |

### Test results
- Unit: **682 passed / 0 failed** (35 test files)
- Integration: pre-existing TLS failures (unrelated); auth schema tests pass
- E2E: requires `E2E_USER_PASSWORD` in env

### Notes
- Magic link path retained in `auth.setup.ts` fallback and `/login` ghost button
- Invite code is still consumed on signup — no rollback if `createUser` fails (admin can reset)
- `NEXT_PUBLIC_AUTH_MAGIC_LINK_ENABLED` must be `"true"` to show magic link option on `/login`
- Tech debt: TD-017 — restore magic link as primary post-domain-verification

---
