-- Migration: 008_checkpoints
-- Refs: P1-03, docs/03-Database-Schema.md §2.8

CREATE TABLE IF NOT EXISTS public.checkpoints (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  plan_id             uuid NOT NULL REFERENCES public.plans(id) ON DELETE CASCADE,
  planned_session_id  uuid REFERENCES public.planned_sessions(id) ON DELETE SET NULL,
  run_id              uuid REFERENCES public.runs(id) ON DELETE SET NULL,
  checkpoint_type     text NOT NULL,
  target_week         int NOT NULL,
  actual_date         date NOT NULL,
  result_seconds      int NOT NULL,
  target_seconds      int NOT NULL,
  verdict             text NOT NULL CHECK (verdict IN ('green', 'amber', 'red')),
  pct_deviation       numeric(4,2),
  recommended_action  text,
  athlete_notes       text,
  created_at          timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.checkpoints ENABLE ROW LEVEL SECURITY;
