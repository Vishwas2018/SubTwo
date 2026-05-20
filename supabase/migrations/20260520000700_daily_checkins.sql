-- Migration: 007_daily_checkins
-- Refs: P1-03, docs/03-Database-Schema.md §2.7

CREATE TABLE IF NOT EXISTS public.daily_checkins (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  checkin_date date NOT NULL,
  sleep_hours  numeric(3,1) CHECK (sleep_hours BETWEEN 0 AND 24),
  resting_hr   int CHECK (resting_hr BETWEEN 30 AND 120),
  weight_kg    numeric(4,1),
  energy_1to5  int CHECK (energy_1to5 BETWEEN 1 AND 5),
  mood_1to5    int CHECK (mood_1to5 BETWEEN 1 AND 5),
  niggle_today boolean NOT NULL DEFAULT false,
  notes        text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, checkin_date)
);

ALTER TABLE public.daily_checkins ENABLE ROW LEVEL SECURITY;
