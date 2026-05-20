-- Migration: 015_audit_log
-- Refs: P1-03, docs/03-Database-Schema.md §2.15

CREATE TABLE IF NOT EXISTS public.audit_log (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  action      text NOT NULL,
  entity_type text,
  entity_id   uuid,
  metadata    jsonb,
  ip_address  inet,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- No RLS policies = deny all for anon/authenticated roles (service role only)
COMMENT ON TABLE public.audit_log IS 'Server-only via service role; no RLS policies intentional — deny all client access';
