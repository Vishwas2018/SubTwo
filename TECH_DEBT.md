# Tech Debt

---

## TD-017 · Restore magic link as primary auth post-domain

**Filed:** 2026-06-01  
**Priority:** Medium  
**Context:** beta-auth-unblock

Magic link sign-in was feature-flagged (`NEXT_PUBLIC_AUTH_MAGIC_LINK_ENABLED`) to unblock beta testing without SMTP. Once the production domain is verified and Supabase email delivery is confirmed working:

1. Set `NEXT_PUBLIC_AUTH_MAGIC_LINK_ENABLED=true` in Vercel env
2. Swap `/login` primary CTA back to magic link (promote ghost button → primary, demote password → secondary)
3. Remove `email_confirm: true` from `/api/auth/signup` (let Supabase send confirmation email)
4. Update `tests/e2e/auth.setup.ts` to remove password fallback or keep both paths

**Refs:** `app/(auth)/login/page.tsx`, `app/api/auth/signup/route.ts`, `tests/e2e/auth.setup.ts`

---
