-- Migration: 014_ai_generations
-- Refs: P1-03, docs/03-Database-Schema.md §2.14

CREATE TABLE IF NOT EXISTS public.ai_generations (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  purpose             text NOT NULL CHECK (purpose IN ('initial_plan', 'regen_full', 'regen_remaining')),
  model               text NOT NULL,
  input_tokens        int,
  output_tokens       int,
  estimated_cost_usd  numeric(6,4),
  success             boolean,
  error_message       text,
  duration_ms         int,
  created_at          timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_generations ENABLE ROW LEVEL SECURITY;

CREATE INDEX ai_generations_user_created_idx ON public.ai_generations (user_id, created_at);

-- Now add the deferred FK from plan_versions.ai_generation_id -> ai_generations
ALTER TABLE public.plan_versions
  ADD CONSTRAINT plan_versions_ai_generation_id_fkey
  FOREIGN KEY (ai_generation_id)
  REFERENCES public.ai_generations(id)
  ON DELETE SET NULL;
