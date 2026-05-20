-- Migration: 005_planned_sessions
-- Refs: P1-03, docs/03-Database-Schema.md §2.5

CREATE TABLE IF NOT EXISTS public.planned_sessions (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id          uuid NOT NULL REFERENCES public.plans(id) ON DELETE CASCADE,
  plan_version_id  uuid NOT NULL REFERENCES public.plan_versions(id) ON DELETE CASCADE,
  week_number      int NOT NULL,
  day_of_week      int NOT NULL CHECK (day_of_week BETWEEN 1 AND 7),
  scheduled_date   date NOT NULL,
  phase            text NOT NULL CHECK (phase IN ('base', 'build', 'peak', 'taper')),
  session_type     text NOT NULL CHECK (session_type IN (
    'rest', 'easy', 'easy_strides', 'long_run', 'threshold',
    'interval', 'tempo', 'race_pace', 'time_trial', 'strength', 'race'
  )),
  distance_km      numeric(5,2),
  target_pace_min  numeric(4,2),
  target_pace_max  numeric(4,2),
  structure        text,
  focus            text,
  notes            text,
  is_deload        boolean NOT NULL DEFAULT false,
  is_checkpoint    boolean NOT NULL DEFAULT false,
  checkpoint_type  text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (plan_id, week_number, day_of_week, plan_version_id)
);

ALTER TABLE public.planned_sessions ENABLE ROW LEVEL SECURITY;
