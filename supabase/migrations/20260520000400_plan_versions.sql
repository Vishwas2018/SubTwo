-- Migration: 004_plan_versions
-- Refs: P1-03, docs/03-Database-Schema.md §2.4

CREATE TABLE IF NOT EXISTS public.plan_versions (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id          uuid NOT NULL REFERENCES public.plans(id) ON DELETE CASCADE,
  version_number   int NOT NULL,
  generated_by     text NOT NULL CHECK (generated_by IN ('ai', 'rule_adjustment', 'manual')),
  ai_generation_id uuid, -- FK to ai_generations added after 014
  raw_plan_json    jsonb NOT NULL,
  reason           text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (plan_id, version_number)
);

ALTER TABLE public.plan_versions ENABLE ROW LEVEL SECURITY;

-- Now add the deferred FK from plans.current_version_id -> plan_versions
ALTER TABLE public.plans
  ADD CONSTRAINT plans_current_version_id_fkey
  FOREIGN KEY (current_version_id)
  REFERENCES public.plan_versions(id)
  ON DELETE SET NULL
  DEFERRABLE INITIALLY DEFERRED;
