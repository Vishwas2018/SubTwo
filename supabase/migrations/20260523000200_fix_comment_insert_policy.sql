-- Migration: fix_comment_insert_policy
-- Refs: P3-08 — the FOR ALL author_owns_comment policy unintentionally permits any
-- authenticated user to insert a comment on any run (only requiring author_id = auth.uid()).
-- Fix: narrow it to SELECT/UPDATE/DELETE and add an explicit INSERT policy for run owners.

ALTER POLICY "author_owns_comment" ON public.run_comments
  RENAME TO "author_manages_own_comments";

-- Drop the old FOR ALL policy and recreate as SELECT/UPDATE/DELETE only
DROP POLICY "author_manages_own_comments" ON public.run_comments;

CREATE POLICY "author_manages_own_comments" ON public.run_comments
  FOR SELECT USING (author_id = auth.uid());

CREATE POLICY "author_updates_own_comments" ON public.run_comments
  FOR UPDATE USING (author_id = auth.uid()) WITH CHECK (author_id = auth.uid());

CREATE POLICY "author_deletes_own_comments" ON public.run_comments
  FOR DELETE USING (author_id = auth.uid());

-- Explicit INSERT policy: run owner (athlete) can post on their own runs
CREATE POLICY "run_owner_can_comment" ON public.run_comments
  FOR INSERT WITH CHECK (
    author_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.runs r
      WHERE r.id = run_comments.run_id AND r.user_id = auth.uid()
    )
  );
