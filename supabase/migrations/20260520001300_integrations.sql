-- Migration: 013_integrations
-- Refs: P1-03, docs/03-Database-Schema.md §2.13
-- Note: tokens stored as plain TEXT; encryption deferred to Phase 3 (TD-008)

CREATE TABLE IF NOT EXISTS public.integrations (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  provider         text NOT NULL CHECK (provider IN ('strava', 'garmin')),
  access_token     text NOT NULL,
  refresh_token    text,
  expires_at       timestamptz,
  external_user_id text,
  scopes           text[],
  connected_at     timestamptz NOT NULL DEFAULT now(),
  last_sync_at     timestamptz,
  status           text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'revoked')),
  UNIQUE (user_id, provider)
);

ALTER TABLE public.integrations ENABLE ROW LEVEL SECURITY;
