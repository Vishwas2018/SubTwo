-- Migration: run_owner_reads_comments
-- Refs: P3-08 — athlete (run owner) must read coach comments on their own runs.
-- Without this policy, RLS only lets users read comments they authored themselves.

CREATE POLICY "run_owner_reads_comments" ON public.run_comments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.runs r
      WHERE r.id = run_comments.run_id AND r.user_id = auth.uid()
    )
  );
