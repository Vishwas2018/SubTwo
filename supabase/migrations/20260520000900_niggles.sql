-- Migration: 009_niggles
-- Refs: P1-03, docs/03-Database-Schema.md §2.9

CREATE TABLE IF NOT EXISTS public.niggles (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  body_part      text NOT NULL,
  severity       int NOT NULL CHECK (severity BETWEEN 1 AND 10),
  started_date   date NOT NULL,
  resolved_date  date,
  notes          text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.niggles ENABLE ROW LEVEL SECURITY;

-- Partial index for active (unresolved) niggles
CREATE INDEX niggles_active_idx ON public.niggles (user_id, resolved_date)
  WHERE resolved_date IS NULL;
