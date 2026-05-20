-- Migration: 003_plans
-- Refs: P1-03, docs/03-Database-Schema.md §2.3
-- Note: current_version_id FK to plan_versions added after 004 (circular ref)

CREATE TABLE IF NOT EXISTS public.plans (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status             text NOT NULL CHECK (status IN ('draft', 'active', 'completed', 'archived')),
  race_distance_km   numeric(5,2) NOT NULL,
  race_name          text,
  race_date          date NOT NULL,
  start_date         date NOT NULL,
  total_weeks        int NOT NULL,
  experience_level   text NOT NULL CHECK (experience_level IN ('beginner', 'intermediate', 'advanced')),
  baseline_data      jsonb NOT NULL,
  goal_time_seconds  int,
  pace_zones         jsonb NOT NULL,
  current_version_id uuid, -- FK added after plan_versions table exists
  created_at         timestamptz NOT NULL DEFAULT now(),
  activated_at       timestamptz,
  completed_at       timestamptz
);

ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;

-- Enforces one active plan per user
CREATE UNIQUE INDEX one_active_plan_per_user ON public.plans (user_id) WHERE status = 'active';
