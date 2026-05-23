-- Day 25: fix RLS gaps found by pnpm audit:rls (P3-02 script)
-- ai_budget_alerts: RLS was disabled; audit_log: RLS on but no policies.
-- Both tables are write-only for service_role (bypasses RLS).
-- Admin users can read via authenticated session.

ALTER TABLE public.ai_budget_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins can read budget alerts"
  ON public.ai_budget_alerts
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.is_admin = true
    )
  );

CREATE POLICY "admins can read audit log"
  ON public.audit_log
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.is_admin = true
    )
  );
