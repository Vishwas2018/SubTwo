-- Migration: 012_run_comments
-- Refs: P1-03, docs/03-Database-Schema.md §2.12

CREATE TABLE IF NOT EXISTS public.run_comments (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id     uuid NOT NULL REFERENCES public.runs(id) ON DELETE CASCADE,
  author_id  uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  comment    text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

ALTER TABLE public.run_comments ENABLE ROW LEVEL SECURITY;
