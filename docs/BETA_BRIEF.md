# SubTwo Beta Brief — Wave 1

**Version:** beta-1.2  
**Date:** 2026-06-05 (updated from 2026-06-04)  
**Audience:** Invited testers

---

## What is SubTwo?

SubTwo is a personalised marathon training app. You give it your race, your fitness level, and your schedule. It generates a structured training plan, tracks your runs, monitors your recovery, and adjusts your plan based on how you're progressing.

---

## How to Get Access

1. Go to **https://subtwo.vercel.app/signup**
2. Enter your invite code when prompted (provided by the SubTwo team)
3. Create an account with your email
4. Complete the quick setup wizard to generate your plan

---

## What to Test

Please focus your feedback on these flows:

### Core flow
- [ ] **Wizard** — Sign up → 3-step wizard (Your Race, About You, Optional Extras) → Generate plan
- [ ] **Dashboard** — Today's session card loads; date header is correct; no "Dashboard" title
- [ ] **Inline check-in** — Daily check-in card on dashboard; tap niggle toggle to expand description; submit collapses to "✓ Checked in today · [Edit]"
- [ ] **Log a run** — Tap "Log Run" on today's card; fill distance + time; submit lands back on dashboard
- [ ] **Session detail** — Tap "View Details" to see the planned session

### Navigation
- [ ] Persistent nav (Home / Plan / Log / Me) works on all pages
- [ ] Mobile bottom tab bar is usable at phone-width (375px)
- [ ] Desktop sidebar shows on wide screens

### Plan & progress
- [ ] `/plan` — Weekly calendar loads, sessions colour-coded by type
- [ ] Week progress bars on dashboard update after logging a run
- [ ] Session types render correctly (Easy, Long, Threshold, etc.)

### Optional
- [ ] Coach invite: Settings → Sharing → invite a coach email
- [ ] "Start over" in Settings → Profile to regenerate your plan (confirm dialog)

---

## How to Report Issues

Use the **Beta Feedback** card in **Settings** (tap Me → Settings → scroll to bottom).

Please include:
- What you were doing
- What you expected to happen
- What actually happened
- Device/browser (phone model, iOS/Android/browser)

For critical issues (login broken, data lost): email **vishwas.joshi01@gmail.com** directly.

---

## AI Provider Status (as of 2026-06-05)

| Provider | Available in wizard | Typical latency | Notes |
|----------|-------------------|----------------|-------|
| **Qwen** (default) | ✅ Yes | 30–40 s | qwen-turbo; free tier |
| ~~Claude~~ | ❌ Hidden | — | Disabled for beta — volume-cap compliance too low (TD-021) |
| ~~Groq~~ | ❌ Hidden | — | Disabled for beta — free-tier instability (TD-020) |

**Single provider for Wave 1:** Qwen (qwen-turbo). Claude adapter remains active as the fallback on schema failure.

---

## Known Limitations

- **No Android native app** — browser only (add to home screen for app-like feel)
- **AI plan generation** — takes 30–45 s; please wait; do not refresh
- **If generation fails** — tap "Try again" or use Settings → Profile → Start over
- **Check-in route `/check-in` still exists** — the dashboard inline card is the primary path
- **No push notifications** — check the app daily

---

## What's Out of Scope for Wave 1

- Checkpoints assessment flow
- Niggles detailed management
- Export / data download
- Coach view (read-only access for coaches)

These exist in the app but are not the focus for this wave.

---

## Support

Feedback card in Settings is the primary channel. The team reads every submission.

Thank you for testing SubTwo — your feedback directly shapes the product.
