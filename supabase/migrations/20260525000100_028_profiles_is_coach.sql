-- Migration 028: add is_coach to profiles
-- is_coach was referenced in coach-sharing feature (P3-08) but the column
-- was never added to the DB. Adding it now with a safe default.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_coach BOOLEAN NOT NULL DEFAULT false;

-- Coaches can read the profiles of athletes assigned to them.
-- (Existing viewer_access policies already gate coach→athlete visibility;
--  this column is read via the admin API and coach pages.)
