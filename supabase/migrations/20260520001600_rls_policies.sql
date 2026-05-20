-- Migration: 016_rls_policies
-- Refs: P1-04, docs/03-Database-Schema.md §3, docs/06-Auth-Security.md §3

-- ─── profiles ───────────────────────────────────────────────────────────────

CREATE POLICY "self_read" ON public.profiles
  FOR SELECT USING (id = auth.uid());

CREATE POLICY "self_update" ON public.profiles
  FOR UPDATE USING (id = auth.uid()) WITH CHECK (id = auth.uid());

-- ─── invite_codes (admin only) ───────────────────────────────────────────────

CREATE POLICY "admin_full_access" ON public.invite_codes
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- ─── plans ───────────────────────────────────────────────────────────────────

CREATE POLICY "owner_full_access" ON public.plans
  FOR ALL USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "viewer_read_access" ON public.plans
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.viewer_access
      WHERE athlete_id = plans.user_id
        AND viewer_id = auth.uid()
        AND status = 'active'
    )
  );

-- ─── plan_versions ───────────────────────────────────────────────────────────

CREATE POLICY "owner_full_access" ON public.plan_versions
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.plans WHERE plans.id = plan_versions.plan_id AND plans.user_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.plans WHERE plans.id = plan_versions.plan_id AND plans.user_id = auth.uid())
  );

CREATE POLICY "viewer_read_access" ON public.plan_versions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.plans p
      JOIN public.viewer_access va ON va.athlete_id = p.user_id
      WHERE p.id = plan_versions.plan_id
        AND va.viewer_id = auth.uid()
        AND va.status = 'active'
    )
  );

-- ─── planned_sessions ────────────────────────────────────────────────────────

CREATE POLICY "owner_full_access" ON public.planned_sessions
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.plans WHERE plans.id = planned_sessions.plan_id AND plans.user_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.plans WHERE plans.id = planned_sessions.plan_id AND plans.user_id = auth.uid())
  );

CREATE POLICY "viewer_read_access" ON public.planned_sessions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.plans p
      JOIN public.viewer_access va ON va.athlete_id = p.user_id
      WHERE p.id = planned_sessions.plan_id
        AND va.viewer_id = auth.uid()
        AND va.status = 'active'
    )
  );

-- ─── runs ────────────────────────────────────────────────────────────────────

CREATE POLICY "owner_full_access" ON public.runs
  FOR ALL USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "viewer_read_access" ON public.runs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.viewer_access
      WHERE athlete_id = runs.user_id
        AND viewer_id = auth.uid()
        AND status = 'active'
    )
  );

-- ─── daily_checkins ──────────────────────────────────────────────────────────

CREATE POLICY "owner_full_access" ON public.daily_checkins
  FOR ALL USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "viewer_read_access" ON public.daily_checkins
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.viewer_access
      WHERE athlete_id = daily_checkins.user_id
        AND viewer_id = auth.uid()
        AND status = 'active'
    )
  );

-- ─── checkpoints ─────────────────────────────────────────────────────────────

CREATE POLICY "owner_full_access" ON public.checkpoints
  FOR ALL USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "viewer_read_access" ON public.checkpoints
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.viewer_access
      WHERE athlete_id = checkpoints.user_id
        AND viewer_id = auth.uid()
        AND status = 'active'
    )
  );

-- ─── niggles ─────────────────────────────────────────────────────────────────

CREATE POLICY "owner_full_access" ON public.niggles
  FOR ALL USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "viewer_read_access" ON public.niggles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.viewer_access
      WHERE athlete_id = niggles.user_id
        AND viewer_id = auth.uid()
        AND status = 'active'
    )
  );

-- ─── plan_adjustments ────────────────────────────────────────────────────────

CREATE POLICY "owner_full_access" ON public.plan_adjustments
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.plans WHERE plans.id = plan_adjustments.plan_id AND plans.user_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.plans WHERE plans.id = plan_adjustments.plan_id AND plans.user_id = auth.uid())
  );

CREATE POLICY "viewer_read_access" ON public.plan_adjustments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.plans p
      JOIN public.viewer_access va ON va.athlete_id = p.user_id
      WHERE p.id = plan_adjustments.plan_id
        AND va.viewer_id = auth.uid()
        AND va.status = 'active'
    )
  );

-- ─── viewer_access ───────────────────────────────────────────────────────────

CREATE POLICY "athlete_manages_access" ON public.viewer_access
  FOR ALL USING (athlete_id = auth.uid())
  WITH CHECK (athlete_id = auth.uid());

CREATE POLICY "viewer_reads_own_access" ON public.viewer_access
  FOR SELECT USING (viewer_id = auth.uid());

-- ─── run_comments ────────────────────────────────────────────────────────────

CREATE POLICY "author_owns_comment" ON public.run_comments
  FOR ALL USING (author_id = auth.uid())
  WITH CHECK (author_id = auth.uid());

CREATE POLICY "viewer_can_insert_comment" ON public.run_comments
  FOR INSERT WITH CHECK (
    author_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.runs r
      JOIN public.viewer_access v ON v.athlete_id = r.user_id
      WHERE r.id = run_comments.run_id
        AND v.viewer_id = auth.uid()
        AND v.status = 'active'
        AND v.can_comment = true
    )
  );

CREATE POLICY "viewer_reads_comments_on_accessible_runs" ON public.run_comments
  FOR SELECT USING (
    author_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.runs r
      JOIN public.viewer_access v ON v.athlete_id = r.user_id
      WHERE r.id = run_comments.run_id
        AND v.viewer_id = auth.uid()
        AND v.status = 'active'
    )
  );

-- ─── integrations ────────────────────────────────────────────────────────────

CREATE POLICY "owner_full_access" ON public.integrations
  FOR ALL USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ─── ai_generations ──────────────────────────────────────────────────────────

CREATE POLICY "owner_full_access" ON public.ai_generations
  FOR ALL USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ─── audit_log ───────────────────────────────────────────────────────────────
-- No policies: RLS enabled (migration 015), zero client policies = deny all.
-- Service role bypasses RLS. Intentional.
