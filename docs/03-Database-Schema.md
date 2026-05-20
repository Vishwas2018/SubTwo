# Database Schema

## SubTwo

**Version:** 1.0 (final) | **Database:** Postgres (Supabase) | **Conventions:** snake_case, UUID PKs, UTC timestamps

---

## 1. ER Overview

```
auth.users (Supabase)
    └─< profiles (1:1)
            ├─< invite_codes (admin created)
            ├─< plans
            │     ├─< plan_versions
            │     ├─< planned_sessions
            │     └─< plan_adjustments
            ├─< runs ──< run_comments
            ├─< daily_checkins
            ├─< checkpoints
            ├─< niggles
            ├─< integrations
            ├─< ai_generations
            ├─< viewer_access
            └─< audit_log
```

## 2. Tables

### 2.1 `profiles`

| Column              | Type                               | Notes                     |
| ------------------- | ---------------------------------- | ------------------------- |
| id                  | uuid PK FK→auth.users              |                           |
| email               | text UNIQUE NOT NULL               |                           |
| display_name        | text                               |                           |
| timezone            | text default 'Australia/Melbourne' |                           |
| invite_code_used    | text                               | Track which code was used |
| is_admin            | boolean default false              |                           |
| ai_generation_count | int default 0                      | Lifetime counter          |
| created_at          | timestamptz default now()          |                           |
| updated_at          | timestamptz default now()          |                           |

### 2.2 `invite_codes`

| Column     | Type                      | Notes                 |
| ---------- | ------------------------- | --------------------- |
| id         | uuid PK                   |                       |
| code       | text UNIQUE NOT NULL      | 8 chars, no ambiguous |
| created_by | uuid FK→profiles          |                       |
| max_uses   | int default 1             | NULL = unlimited      |
| use_count  | int default 0             |                       |
| expires_at | timestamptz               | NULL = never          |
| note       | text                      |                       |
| created_at | timestamptz default now() |                       |

### 2.3 `plans`

| Column             | Type                      | Notes                                      |
| ------------------ | ------------------------- | ------------------------------------------ |
| id                 | uuid PK                   |                                            |
| user_id            | uuid FK→profiles NOT NULL |                                            |
| status             | text NOT NULL             | 'draft'\|'active'\|'completed'\|'archived' |
| race_distance_km   | numeric(5,2) NOT NULL     |                                            |
| race_name          | text                      |                                            |
| race_date          | date NOT NULL             |                                            |
| start_date         | date NOT NULL             |                                            |
| total_weeks        | int NOT NULL              |                                            |
| experience_level   | text NOT NULL             | beginner\|intermediate\|advanced           |
| baseline_data      | jsonb NOT NULL            | Wizard snapshot                            |
| goal_time_seconds  | int                       |                                            |
| pace_zones         | jsonb NOT NULL            |                                            |
| current_version_id | uuid FK→plan_versions     |                                            |
| created_at         | timestamptz default now() |                                            |
| activated_at       | timestamptz               |                                            |
| completed_at       | timestamptz               |                                            |

Partial UNIQUE INDEX on (user_id) WHERE status='active'.

### 2.4 `plan_versions`

| Column           | Type                      | Notes                       |
| ---------------- | ------------------------- | --------------------------- |
| id               | uuid PK                   |                             |
| plan_id          | uuid FK→plans NOT NULL    |                             |
| version_number   | int NOT NULL              |                             |
| generated_by     | text NOT NULL             | ai\|rule_adjustment\|manual |
| ai_generation_id | uuid FK→ai_generations    |                             |
| raw_plan_json    | jsonb NOT NULL            |                             |
| reason           | text                      |                             |
| created_at       | timestamptz default now() |                             |

### 2.5 `planned_sessions`

| Column          | Type                           | Notes                                                                                                 |
| --------------- | ------------------------------ | ----------------------------------------------------------------------------------------------------- |
| id              | uuid PK                        |                                                                                                       |
| plan_id         | uuid FK→plans NOT NULL         |                                                                                                       |
| plan_version_id | uuid FK→plan_versions NOT NULL |                                                                                                       |
| week_number     | int NOT NULL                   |                                                                                                       |
| day_of_week     | int NOT NULL                   | 1=Mon, 7=Sun                                                                                          |
| scheduled_date  | date NOT NULL                  |                                                                                                       |
| phase           | text NOT NULL                  | base\|build\|peak\|taper                                                                              |
| session_type    | text NOT NULL                  | rest\|easy\|easy_strides\|long_run\|threshold\|interval\|tempo\|race_pace\|time_trial\|strength\|race |
| distance_km     | numeric(5,2)                   |                                                                                                       |
| target_pace_min | numeric(4,2)                   | min/km lower                                                                                          |
| target_pace_max | numeric(4,2)                   | min/km upper                                                                                          |
| structure       | text                           |                                                                                                       |
| focus           | text                           |                                                                                                       |
| notes           | text                           |                                                                                                       |
| is_deload       | boolean default false          |                                                                                                       |
| is_checkpoint   | boolean default false          |                                                                                                       |
| checkpoint_type | text                           |                                                                                                       |
| created_at      | timestamptz default now()      |                                                                                                       |

UNIQUE(plan_id, week_number, day_of_week, plan_version_id)

### 2.6 `runs`

| Column             | Type                      | Notes                  |
| ------------------ | ------------------------- | ---------------------- |
| id                 | uuid PK                   |                        |
| user_id            | uuid FK→profiles NOT NULL |                        |
| planned_session_id | uuid FK→planned_sessions  | NULL if unplanned      |
| source             | text NOT NULL             | manual\|strava\|garmin |
| external_id        | text                      |                        |
| run_date           | date NOT NULL             |                        |
| start_time         | timestamptz               |                        |
| distance_km        | numeric(5,2) NOT NULL     |                        |
| duration_seconds   | int NOT NULL              |                        |
| avg_pace_seconds   | int GENERATED             |                        |
| avg_hr             | int                       |                        |
| max_hr             | int                       |                        |
| elevation_gain_m   | int                       |                        |
| avg_cadence        | int                       |                        |
| rpe                | int CHECK (1..10)         |                        |
| felt_easy          | boolean                   |                        |
| stitch_occurred    | boolean default false     |                        |
| stitch_severity    | int CHECK (1..10)         |                        |
| shoes              | text                      |                        |
| weather            | jsonb                     |                        |
| notes              | text                      |                        |
| raw_data           | jsonb                     |                        |
| created_at         | timestamptz default now() |                        |
| deleted_at         | timestamptz               | Soft delete            |

INDEX (user_id, run_date DESC). UNIQUE(source, external_id) WHERE external_id IS NOT NULL.

### 2.7 `daily_checkins`

| Column       | Type                       | Notes |
| ------------ | -------------------------- | ----- |
| id           | uuid PK                    |       |
| user_id      | uuid FK→profiles NOT NULL  |       |
| checkin_date | date NOT NULL              |       |
| sleep_hours  | numeric(3,1) CHECK (0..24) |       |
| resting_hr   | int CHECK (30..120)        |       |
| weight_kg    | numeric(4,1)               |       |
| energy_1to5  | int CHECK (1..5)           |       |
| mood_1to5    | int CHECK (1..5)           |       |
| niggle_today | boolean default false      |       |
| notes        | text                       |       |
| created_at   | timestamptz default now()  |       |

UNIQUE(user_id, checkin_date)

### 2.8 `checkpoints`

| Column             | Type                      | Notes                               |
| ------------------ | ------------------------- | ----------------------------------- |
| id                 | uuid PK                   |                                     |
| user_id            | uuid FK→profiles NOT NULL |                                     |
| plan_id            | uuid FK→plans NOT NULL    |                                     |
| planned_session_id | uuid FK→planned_sessions  |                                     |
| run_id             | uuid FK→runs              |                                     |
| checkpoint_type    | text NOT NULL             | Freeform: 5k\|10k\|half\|tempo_test |
| target_week        | int NOT NULL              |                                     |
| actual_date        | date NOT NULL             |                                     |
| result_seconds     | int NOT NULL              |                                     |
| target_seconds     | int NOT NULL              |                                     |
| verdict            | text NOT NULL             | green\|amber\|red                   |
| pct_deviation      | numeric(4,2)              |                                     |
| recommended_action | text                      |                                     |
| athlete_notes      | text                      |                                     |
| created_at         | timestamptz default now() |                                     |

### 2.9 `niggles`

| Column        | Type                       | Notes |
| ------------- | -------------------------- | ----- |
| id            | uuid PK                    |       |
| user_id       | uuid FK→profiles NOT NULL  |       |
| body_part     | text NOT NULL              |       |
| severity      | int CHECK (1..10) NOT NULL |       |
| started_date  | date NOT NULL              |       |
| resolved_date | date                       |       |
| notes         | text                       |       |
| created_at    | timestamptz default now()  |       |
| updated_at    | timestamptz default now()  |       |

INDEX (user_id, resolved_date) WHERE resolved_date IS NULL.

### 2.10 `plan_adjustments`

| Column               | Type                      | Notes                                                                                          |
| -------------------- | ------------------------- | ---------------------------------------------------------------------------------------------- |
| id                   | uuid PK                   |                                                                                                |
| plan_id              | uuid FK→plans NOT NULL    |                                                                                                |
| trigger              | text NOT NULL             | missed_sessions\|rhr_elevated\|niggle_persistent\|easy_too_fast\|sleep_deficit\|checkpoint_red |
| affected_session_ids | uuid[]                    |                                                                                                |
| change_summary       | text NOT NULL             |                                                                                                |
| change_details       | jsonb                     |                                                                                                |
| user_override        | boolean default false     |                                                                                                |
| created_at           | timestamptz default now() |                                                                                                |

### 2.11 `viewer_access`

| Column       | Type                      | Notes                    |
| ------------ | ------------------------- | ------------------------ |
| id           | uuid PK                   |                          |
| athlete_id   | uuid FK→profiles NOT NULL |                          |
| viewer_id    | uuid FK→profiles          | NULL until accepted      |
| invite_email | text NOT NULL             |                          |
| invite_token | text UNIQUE               |                          |
| status       | text default 'pending'    | pending\|active\|revoked |
| can_comment  | boolean default true      |                          |
| invited_at   | timestamptz default now() |                          |
| accepted_at  | timestamptz               |                          |
| revoked_at   | timestamptz               |                          |

### 2.12 `run_comments`

| Column     | Type                      | Notes       |
| ---------- | ------------------------- | ----------- |
| id         | uuid PK                   |             |
| run_id     | uuid FK→runs NOT NULL     |             |
| author_id  | uuid FK→profiles NOT NULL |             |
| comment    | text NOT NULL             | Single-line |
| created_at | timestamptz default now() |             |
| deleted_at | timestamptz               |             |

### 2.13 `integrations`

| Column           | Type                      | Notes                    |
| ---------------- | ------------------------- | ------------------------ |
| id               | uuid PK                   |                          |
| user_id          | uuid FK→profiles NOT NULL |                          |
| provider         | text NOT NULL             | strava\|garmin           |
| access_token     | text NOT NULL (encrypted) |                          |
| refresh_token    | text (encrypted)          |                          |
| expires_at       | timestamptz               |                          |
| external_user_id | text                      |                          |
| scopes           | text[]                    |                          |
| connected_at     | timestamptz default now() |                          |
| last_sync_at     | timestamptz               |                          |
| status           | text default 'active'     | active\|expired\|revoked |

UNIQUE(user_id, provider)

### 2.14 `ai_generations`

| Column             | Type                      | Notes                                     |
| ------------------ | ------------------------- | ----------------------------------------- |
| id                 | uuid PK                   |                                           |
| user_id            | uuid FK→profiles          |                                           |
| purpose            | text NOT NULL             | initial_plan\|regen_full\|regen_remaining |
| model              | text NOT NULL             |                                           |
| input_tokens       | int                       |                                           |
| output_tokens      | int                       |                                           |
| estimated_cost_usd | numeric(6,4)              |                                           |
| success            | boolean                   |                                           |
| error_message      | text                      |                                           |
| duration_ms        | int                       |                                           |
| created_at         | timestamptz default now() |                                           |

INDEX (user_id, created_at).

### 2.15 `audit_log`

| Column      | Type                      | Notes |
| ----------- | ------------------------- | ----- |
| id          | uuid PK                   |       |
| user_id     | uuid FK→profiles          |       |
| action      | text NOT NULL             |       |
| entity_type | text                      |       |
| entity_id   | uuid                      |       |
| metadata    | jsonb                     |       |
| ip_address  | inet                      |       |
| created_at  | timestamptz default now() |       |

## 3. RLS Policies

```sql
-- Owner full access (applies to: runs, daily_checkins, checkpoints, niggles,
-- planned_sessions, integrations, plans, plan_versions, plan_adjustments, ai_generations)
CREATE POLICY "owner_full_access" ON <table>
  FOR ALL USING (user_id = auth.uid());

-- Viewer read access
CREATE POLICY "viewer_read_access" ON <table>
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM viewer_access
      WHERE athlete_id = <table>.user_id
        AND viewer_id = auth.uid()
        AND status = 'active')
  );

-- Coach comment
CREATE POLICY "viewer_can_comment" ON run_comments
  FOR INSERT WITH CHECK (
    author_id = auth.uid() AND EXISTS (
      SELECT 1 FROM runs r
      JOIN viewer_access v ON v.athlete_id = r.user_id
      WHERE r.id = run_id AND v.viewer_id = auth.uid()
        AND v.status = 'active' AND v.can_comment = true
    )
  );

-- Admin
CREATE POLICY "admin_full_access" ON invite_codes
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true)
  );
```

## 4. Helper Functions

- `validate_invite_code(code text) → boolean` — atomic check + increment
- `check_ai_quota(user_id uuid) → boolean` — lifetime + daily cap check
- `compute_checkpoint_verdict(target_seconds int, result_seconds int) → text` — green/amber/red
- `apply_plan_version(plan_id uuid, version_id uuid)` — swap planned_sessions
- `match_run_to_planned_session(run_id uuid)` — date-based auto-link

## 5. Migration Order

```
20260520_001_profiles.sql
20260520_002_invite_codes.sql
20260520_003_plans.sql
20260520_004_plan_versions.sql
20260520_005_planned_sessions.sql
20260520_006_runs.sql
20260520_007_daily_checkins.sql
20260520_008_checkpoints.sql
20260520_009_niggles.sql
20260520_010_plan_adjustments.sql
20260520_011_viewer_access.sql
20260520_012_run_comments.sql
20260520_013_integrations.sql
20260520_014_ai_generations.sql
20260520_015_audit_log.sql
20260520_016_rls_policies.sql
20260520_017_indexes.sql
20260520_018_helper_functions.sql
20260520_019_seed_admin.sql       -- inserts admin email row
```

## 6. Storage Estimate

| Per active user      | Size        |
| -------------------- | ----------- |
| 1 plan + 3 versions  | ~150 KB     |
| 140 planned_sessions | ~50 KB      |
| 100 runs/yr          | ~50 KB      |
| **Total**            | **~250 KB** |

500 MB free tier ≈ 2,000 users.
