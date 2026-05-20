-- Migration: 006_runs
-- Refs: P1-03, docs/03-Database-Schema.md §2.6

CREATE TABLE IF NOT EXISTS public.runs (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  planned_session_id  uuid REFERENCES public.planned_sessions(id) ON DELETE SET NULL,
  source              text NOT NULL CHECK (source IN ('manual', 'strava', 'garmin')),
  external_id         text,
  run_date            date NOT NULL,
  start_time          timestamptz,
  distance_km         numeric(5,2) NOT NULL,
  duration_seconds    int NOT NULL,
  avg_pace_seconds    int GENERATED ALWAYS AS (
    CASE WHEN distance_km > 0 THEN (duration_seconds::numeric / distance_km)::int ELSE NULL END
  ) STORED,
  avg_hr              int,
  max_hr              int,
  elevation_gain_m    int,
  avg_cadence         int,
  rpe                 int CHECK (rpe BETWEEN 1 AND 10),
  felt_easy           boolean,
  stitch_occurred     boolean NOT NULL DEFAULT false,
  stitch_severity     int CHECK (stitch_severity BETWEEN 1 AND 10),
  shoes               text,
  weather             jsonb,
  notes               text,
  raw_data            jsonb,
  created_at          timestamptz NOT NULL DEFAULT now(),
  deleted_at          timestamptz
);

ALTER TABLE public.runs ENABLE ROW LEVEL SECURITY;

CREATE INDEX runs_user_date_idx ON public.runs (user_id, run_date DESC);

CREATE UNIQUE INDEX runs_source_external_id_idx
  ON public.runs (source, external_id)
  WHERE external_id IS NOT NULL;
