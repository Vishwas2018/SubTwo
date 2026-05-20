-- Migration: 002_invite_codes
-- Refs: P1-03, docs/03-Database-Schema.md §2.2

CREATE TABLE IF NOT EXISTS public.invite_codes (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code       text UNIQUE NOT NULL,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  max_uses   int DEFAULT 1,
  use_count  int NOT NULL DEFAULT 0,
  expires_at timestamptz,
  note       text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.invite_codes ENABLE ROW LEVEL SECURITY;
