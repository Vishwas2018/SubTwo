-- Migration: 017_indexes
-- Refs: P1-05, docs/03-Database-Schema.md §2 (index hints per table)
-- Note: some indexes already created in 001-016; using IF NOT EXISTS throughout.

-- runs: date-ordered lookup per user (also in 006 but idempotent)
CREATE INDEX IF NOT EXISTS idx_runs_user_date ON public.runs (user_id, run_date DESC);

-- planned_sessions: fetch sessions for a plan ordered by date
CREATE INDEX IF NOT EXISTS idx_planned_sessions_plan_date ON public.planned_sessions (plan_id, scheduled_date);

-- planned_sessions: fetch by week/day for schedule rendering
CREATE INDEX IF NOT EXISTS idx_planned_sessions_user_today ON public.planned_sessions (plan_id, week_number, day_of_week);

-- run_comments: paginate comments for a run in chronological order
CREATE INDEX IF NOT EXISTS idx_run_comments_run ON public.run_comments (run_id, created_at);

-- viewer_access: look up all coaching relationships for a viewer
CREATE INDEX IF NOT EXISTS idx_viewer_access_viewer_status ON public.viewer_access (viewer_id, status);

-- ai_generations: usage/cost queries per user over time (also in 014 but idempotent)
CREATE INDEX IF NOT EXISTS idx_ai_generations_user_date ON public.ai_generations (user_id, created_at DESC);

-- audit_log: per-user activity feed
CREATE INDEX IF NOT EXISTS idx_audit_log_user_date ON public.audit_log (user_id, created_at DESC);

-- niggles: active niggles fast lookup (also in 009 but idempotent)
CREATE INDEX IF NOT EXISTS idx_niggles_active ON public.niggles (user_id, resolved_date)
  WHERE resolved_date IS NULL;

-- plans: list all plans for a user filtered by status
CREATE INDEX IF NOT EXISTS idx_plans_user_status ON public.plans (user_id, status);
