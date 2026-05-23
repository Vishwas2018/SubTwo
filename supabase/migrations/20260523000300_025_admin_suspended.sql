-- Migration: 025_admin_suspended
-- Refs: P3-09
-- Adds suspended flag to profiles so admins can block users.
-- Admin data queries use service_role (bypasses RLS), so no recursive
-- profile-reads-profile RLS policy needed.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS suspended boolean NOT NULL DEFAULT false;

-- SECURITY DEFINER helper so non-recursive admin checks can be added later
-- without rewriting all callers.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT is_admin FROM public.profiles WHERE id = auth.uid()),
    false
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
