-- Migration: 030_rollback_invite_code
-- Decrements use_count when user creation fails after code was consumed.
CREATE OR REPLACE FUNCTION public.rollback_invite_code(p_code TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.invite_codes
  SET use_count = GREATEST(use_count - 1, 0)
  WHERE code = p_code;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rollback_invite_code(TEXT) TO authenticated, anon;
