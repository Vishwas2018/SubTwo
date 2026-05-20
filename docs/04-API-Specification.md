# API Specification
## SubTwo

**Version:** 1.0 (final) | **Base:** `/api` | **Auth:** Supabase JWT cookie | **Format:** JSON, ISO 8601 UTC, paces in seconds/km

---

## 1. Conventions

- Success: `200/201` with `{ data: ... }`
- Error: `4xx/5xx` with `{ error: { code, message, details? } }`
- Pagination: `?limit=20&cursor=<id>` → `{ data, next_cursor }`
- All queries auto-scoped via RLS (`auth.uid()`)

## 2. Endpoint Index

### Auth & Profile
| Method | Path | Purpose |
|---|---|---|
| POST | /api/auth/signup | Email + invite code |
| POST | /api/auth/login | Magic link |
| GET | /api/me | Current profile |
| PATCH | /api/me | Update profile |

### Plans (AI-driven)
| Method | Path | Purpose |
|---|---|---|
| POST | /api/plans/generate | Wizard → AI plan |
| POST | /api/plans/:id/regenerate | New version |
| POST | /api/plans/:id/activate | Draft → active |
| POST | /api/plans/:id/archive | |
| GET | /api/plans/active | Current active plan |
| GET | /api/plans/:id/versions | Version history |
| GET | /api/plans/:id/adjustments | Auto-adjustment log |
| POST | /api/plans/:id/adjustments/:adjId/override | Revert |

### Plan Browsing
| GET | /api/plan/week/:n | Single week sessions |
| GET | /api/plan/today | Today's session(s) |
| GET | /api/sessions/:id | Session + run + comments |

### Runs
| GET | /api/runs | Paginated, filterable |
| POST | /api/runs | Manual entry |
| PATCH | /api/runs/:id | Edit |
| DELETE | /api/runs/:id | Soft delete |
| POST | /api/runs/:id/comments | Add comment |

### Tracking
| GET, POST | /api/checkins | List/upsert |
| GET, POST | /api/checkpoints | List/log |
| GET, POST, PATCH | /api/niggles | List/create/update |

### Dashboard & Export
| GET | /api/dashboard | Aggregated |
| GET | /api/export | Full JSON dump |

### Sharing
| POST, GET, DELETE | /api/invites | Coach invites |
| GET | /api/invites/accept/:token | Public accept |

### Integrations
| POST | /api/integrations/:provider/connect | OAuth start |
| GET | /api/integrations/:provider/callback | OAuth return |
| DELETE | /api/integrations/:provider | Disconnect |

### Webhooks & Cron
| GET, POST | /api/webhooks/strava | Verify + receive |
| POST | /api/cron/garmin-sync | Garmin polling |
| POST | /api/cron/adjustments | Nightly rule checks |

### Admin
| POST, GET, DELETE | /api/admin/invites | Code management |
| GET | /api/admin/users | User list |
| GET | /api/admin/ai-usage | Cost dashboard |

## 3. Key Request/Response Shapes

### POST /api/auth/signup
```json
// Request
{ "email": "user@example.com", "invite_code": "X7K2NM4P" }
// 201 → magic link sent
// 400 → invalid code (generic message, no enumeration)
```

### POST /api/plans/generate
```json
// Request
{
  "race_distance_km": 21.1,
  "race_date": "2026-10-12",
  "race_name": "Melbourne Half",
  "experience_level": "intermediate",
  "wizard_data": {
    "weekly_km_current": 30,
    "recent_race": { "distance_km": 21.1, "time_seconds": 9174 },
    "days_per_week": 4,
    "goal_time_seconds": 7199,
    "injury_history": "occasional right calf",
    "long_run_day": "sunday"
  }
}
// 201
{
  "data": {
    "plan_id": "uuid",
    "version_id": "uuid",
    "weeks": [...],
    "pace_zones": {...},
    "checkpoints": [...],
    "ai_metadata": { "model": "claude-sonnet-4", "duration_ms": 8421 }
  }
}
// 429 → quota exceeded
```

### POST /api/checkpoints
Server computes verdict + recommended_action via deterministic function.
```json
// Request
{ "checkpoint_type": "5k", "actual_date": "2026-06-15", "result_seconds": 1815, "run_id": "uuid?" }
// 201
{
  "data": {
    "verdict": "amber",
    "pct_deviation": 1.68,
    "recommended_action": "Hold volume next week. Audit easy-pace discipline and sleep. Retest in 2 weeks."
  }
}
```

### GET /api/dashboard
```json
{
  "data": {
    "current_week": { "week_number": 6, "phase": "build", "planned_km": 39, "completed_km": 27, "sessions_completed": 3, "sessions_planned": 5 },
    "next_session": { /* PlannedSession */ },
    "trends_4w": {
      "weekly_km": [33, 36, 28, 36],
      "avg_easy_pace_seconds": [462, 458, 455, 451],
      "avg_sleep_hours": [7.2, 7.4, 7.0, 7.5],
      "avg_rhr": [55, 54, 56, 54]
    },
    "alerts": [ { "level": "warn", "message": "Easy pace creeping under 7:30/km" } ],
    "readiness": { "last_checkpoint": "5k", "last_verdict": "green" },
    "active_niggles_count": 0
  }
}
```

### POST /api/webhooks/strava
- Public endpoint
- Verifies `X-Hub-Signature` HMAC-SHA1
- Responds within 2s (Strava timeout)
- Processes `create`/`update`/`delete` events

### POST /api/cron/adjustments
- Bearer token: `CRON_SECRET`
- Runs nightly, applies 6 rule checks per active plan

## 4. Error Codes

| Code | HTTP | Meaning |
|---|---|---|
| unauthorized | 401 | Missing/invalid JWT |
| forbidden | 403 | RLS denied / not admin |
| not_found | 404 | |
| validation_error | 422 | Zod failure |
| conflict | 409 | Unique violation |
| rate_limited | 429 | |
| quota_exhausted | 429 | AI cap hit |
| invalid_invite | 400 | Generic for security |
| integration_error | 502 | Upstream failed |
| server_error | 500 | |

## 5. Rate Limits

| Endpoint class | Limit |
|---|---|
| Auth reads | 100/min/user |
| Auth writes | 30/min/user |
| Signup | 5/hour/IP |
| AI plan generation | 3/24h, 10 lifetime/user |
| Invites | 5/day/user |
| Export | 1/hour/user |
| Admin | 100/min |

## 6. Validation

All inputs validated with Zod schemas. Pace math + plan structure validated in `lib/plan-validators.ts` after AI response parsing.

## 7. Webhook Security

- Strava: HMAC-SHA1 against `STRAVA_WEBHOOK_VERIFY_TOKEN`
- Cron: bearer `CRON_SECRET`
- Invite tokens: UUID v4, single-use, 7-day expiry
