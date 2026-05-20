-- Migration: 019_seed_admin
-- Refs: P1-05b, docs/03-Database-Schema.md §5
-- Creates a trigger that promotes jvishu21@gmail.com to admin on first signup.
-- Trigger chain: auth.users INSERT → handle_new_user → profiles INSERT → promote_initial_admin.

CREATE OR REPLACE FUNCTION public.promote_initial_admin()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.email = 'jvishu21@gmail.com' THEN
    UPDATE public.profiles SET is_admin = true WHERE id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

-- Drop and recreate trigger to ensure idempotency across push/reset cycles
DROP TRIGGER IF EXISTS promote_admin_on_signup ON public.profiles;

CREATE TRIGGER promote_admin_on_signup
  AFTER INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.promote_initial_admin();
