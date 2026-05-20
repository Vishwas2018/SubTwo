-- Migration: 011_viewer_access
-- Refs: P1-03, docs/03-Database-Schema.md §2.11

CREATE TABLE IF NOT EXISTS public.viewer_access (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id   uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  viewer_id    uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  invite_email text NOT NULL,
  invite_token text UNIQUE,
  status       text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'revoked')),
  can_comment  boolean NOT NULL DEFAULT true,
  invited_at   timestamptz NOT NULL DEFAULT now(),
  accepted_at  timestamptz,
  revoked_at   timestamptz
);

ALTER TABLE public.viewer_access ENABLE ROW LEVEL SECURITY;
