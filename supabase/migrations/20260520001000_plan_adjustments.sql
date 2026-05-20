-- Migration: 010_plan_adjustments
-- Refs: P1-03, docs/03-Database-Schema.md §2.10

CREATE TABLE IF NOT EXISTS public.plan_adjustments (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id              uuid NOT NULL REFERENCES public.plans(id) ON DELETE CASCADE,
  trigger              text NOT NULL CHECK (trigger IN (
    'missed_sessions', 'rhr_elevated', 'niggle_persistent',
    'easy_too_fast', 'sleep_deficit', 'checkpoint_red'
  )),
  affected_session_ids uuid[],
  change_summary       text NOT NULL,
  change_details       jsonb,
  user_override        boolean NOT NULL DEFAULT false,
  created_at           timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.plan_adjustments ENABLE ROW LEVEL SECURITY;
