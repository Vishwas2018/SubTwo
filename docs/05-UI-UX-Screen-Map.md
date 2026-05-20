# UI/UX & Screen Map

## SubTwo

**Version:** 1.0 (final) | **Design system:** shadcn/ui + Tailwind | **Style:** Clean, data-dense, calm

---

## 1. Design Principles

1. Today-first — landing shows today's session in 1s
2. Two clicks to log a run
3. Status before detail (colour verdict, then numbers)
4. Calm during stress — no red alerts unless action required
5. Coach view = athlete view, locked read-only

## 2. Route Map

```
/                          Landing
/login, /signup            Auth (signup requires invite code)
/onboarding/wizard/[step]  7-step plan wizard
/onboarding/review         Generated plan preview

(authenticated app)
/dashboard                 Home
/plan                      20-week table
/plan/week/[n]             Week detail
/plan/adjustments          Auto-adjustment history
/plan/regenerate           Regen flow
/session/[id]              Session + run + comments
/log                       Manual run entry
/check-in                  Daily morning check-in
/checkpoints               Time trial results
/history                   Run history (filterable)
/niggles                   Active + resolved
/settings                  Profile, integrations, sharing, data

(coach)
/coach                     List of athletes I can view
/coach/[athleteId]/*       Athlete views (read-only + comments)

(admin)
/admin                     Overview
/admin/invites             Invite codes
/admin/users               User list
/admin/ai-usage            Cost dashboard
```

## 3. Navigation

**Persistent sidebar (desktop) / bottom tab bar (mobile):**
🏠 Today · 📅 Plan · 📊 History · ✅ Check-in · 🎯 Checkpoints · ⚠️ Niggles · ⚙️ Settings

Top bar: app name, current week chip ("Week 6 · Build"), user dropdown.

## 4. Signup

```
┌────────────────────────────────────────┐
│ Sign Up                                │
├────────────────────────────────────────┤
│ Invite code   [________]  (8 chars)    │
│ Email         [_____________________]  │
│                                        │
│ [ Send magic link ]                    │
│                                        │
│ Don't have a code? Invite-only beta.   │
└────────────────────────────────────────┘
```

Client validates format; server validates existence + atomic increment.

## 5. Wizard (7 steps)

### Step 1 — Race basics

Distance (km, freeform + quick presets), date, name (optional)

### Step 2 — Experience level

Beginner / Intermediate / Advanced (radios) — drives Step 3 branching

### Step 3 — Current fitness (branches)

**Beginner:** weekly km, longest recent run, can run 5K without stopping?
**Intermediate:** weekly km, days/week, recent race (distance + time + date)
**Advanced:** weekly km, peak weekly km, recent race, est. threshold pace, years running

### Step 4 — Goal

Specific target time OR "AI suggest realistic range"

### Step 5 — Constraints

Days/week, preferred long-run day, injury history (free text, 500 char cap), other notes

### Step 6 — Equipment (optional)

Shoes, fuel/gel, weight

### Step 7 — Generating (loading)

Streamed progress: analysing fitness → designing periodisation → calculating zones → placing checkpoints (15–30s)

## 6. Review screen

```
┌─────────────────────────────────────────────────────┐
│ Your Plan is Ready                                  │
├─────────────────────────────────────────────────────┤
│ 20-week plan · 21.1km · Oct 12, 2026                │
│ Goal: 1:59:59 (5:41/km)                             │
├─────────────────────────────────────────────────────┤
│ COACHING PHILOSOPHY                                 │
│ "Conservative ramp from your 30km base..."          │
├─────────────────────────────────────────────────────┤
│ PACE ZONES                                          │
│ Easy 7:00–7:45 · Threshold 5:25–5:40 · ...          │
├─────────────────────────────────────────────────────┤
│ CHECKPOINTS                                         │
│ Wk 4: 5K ≤29:45 · Wk 10: 10K ≤59:00 · ...           │
├─────────────────────────────────────────────────────┤
│ VOLUME ARC (bar chart)                              │
├─────────────────────────────────────────────────────┤
│ [Preview Full] [Regenerate] [Accept & Start]        │
└─────────────────────────────────────────────────────┘
```

Regen counter visible: "2 remaining today (8 lifetime)".

## 7. Dashboard

```
┌──────────────────────────────────────────────────────┐
│ Week 6 of 20 · Build · 17 wks to race                │
│ ━━━━━━━━━●─────────────  30%                          │
├──────────────────────────────────────────────────────┤
│ TODAY                                                │
│ Threshold · 8 km · 6:05/km                           │
│ "2k WU + 3×1k @ 6:05, 90s rest + 2k CD"              │
│ [✓ Log Run] [Skip] [Details]                         │
├──────────────────────────────────────────────────────┤
│ THIS WEEK                                            │
│ Mon ✓  Tue ●  Wed ○  Thu ○  Fri ○  Sat ○  Sun ○      │
│ 12 km / 39 km                                         │
├──────────────────────────────────────────────────────┤
│ READINESS                                            │
│ 5K @ 29:32  🟢  Sub-goal: ON TRACK                   │
├──────────────────────────────────────────────────────┤
│ ALERTS (if any)                                      │
│ ⚠ Sleep 6.4h avg last 3 days                         │
├──────────────────────────────────────────────────────┤
│ TRENDS — weekly km, easy pace, sleep, RHR             │
└──────────────────────────────────────────────────────┘
```

## 8. Plan view

20-week table. Cells: R/E#/S/L#/T/I/TT, colour-coded (green = done, blue = today, grey = future, red = missed). Click cell → session detail.

## 9. Session detail

Planned block (type, distance, pace, structure) + Actual block (run data) + Comments thread (single-line). Edit/delete on owner's runs only.

## 10. Log run

Form: date, distance, duration, HR, elevation, RPE slider, felt-easy toggle, stitch (+ severity), shoes, notes, link-to-session dropdown. [Save] [Save & Daily Check-in →]

## 11. Daily check-in

Sleep, RHR, weight (optional), energy 1–5, mood 1–5, niggle flag, notes.

## 12. Checkpoints

3 cards per plan (count varies by program length). Each shows target, result, verdict, recommended action. Pending cards have [Log Result].

## 13. History

Filterable list: phase, type, source, date range. Default: last 30d newest first.

## 14. Niggles

Tabs: Active / Resolved. Banner if any niggle 5+ days: "Consider seeing a physio."

## 15. Settings

Tabs:

- **Profile** — display name, timezone, race date, goal
- **Integrations** — Strava/Garmin connect, last sync
- **Sharing** — current coach, [Invite coach] modal, pending invites
- **Data** — [Export JSON], [Delete account] (double confirm)

## 16. Plan adjustments page

Card per adjustment: trigger, what changed, [Revert]. Sorted newest first.

## 17. Coach view

Identical UI with banner: "Viewing as coach · read-only". Comment forms enabled. No /settings, /log, /check-in.

## 18. Admin

### /admin

Users · pending invites · monthly AI spend · generations today · quick links

### /admin/invites

Table: code, uses, expires, note, actions. [+ New Code] modal.

### /admin/users

Table: email, signup, plan status, last activity, AI gens used, [impersonate/suspend/delete].

### /admin/ai-usage

Month-to-date $, gen count, avg cost, daily charts, top users.

## 19. Empty States

| Screen          | Copy                                                      |
| --------------- | --------------------------------------------------------- |
| No plan         | "Welcome! Let's build your plan. [Start wizard]"          |
| No runs         | "No runs logged yet. Connect Strava or log manually."     |
| No niggles      | "No niggles. Keep it that way." 🎉                        |
| Quota exhausted | "All 10 generations used. Contact admin."                 |
| Invalid invite  | "That code doesn't work. Check with whoever invited you." |
| AI gen failed   | "Couldn't generate. Tap retry or contact support."        |

## 20. Visual Tokens

| Token    | Value                                  | Use          |
| -------- | -------------------------------------- | ------------ |
| --bg     | slate-50/950                           | Page bg      |
| --card   | white/slate-900                        | Cards        |
| --text   | slate-900/100                          | Body         |
| --muted  | slate-500                              | Secondary    |
| --accent | emerald-600                            | Primary CTAs |
| --warn   | amber-500                              | Caution      |
| --danger | red-600                                | Errors       |
| Font     | Inter (sans), JetBrains Mono (numbers) |              |

Dark mode: system default, toggle in settings.

## 21. Mobile + a11y

- Single column <768px, bottom tab bar
- Plan table → vertical cards
- Tap targets ≥44×44 px
- WCAG AA contrast
- ARIA labels on icon buttons
- Status never colour-only (icon + text paired)
