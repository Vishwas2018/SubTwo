-- Migration: 024_ai_budget
-- Refs: P3-03
-- Adds:
--   ai_budget_alerts          — dedup table: one row per (month, level) prevents repeat alerts
--   get_monthly_ai_spend()    — SUM(estimated_cost_usd) for current calendar month (success=true)
--   check_global_ai_budget()  — {month_spend, soft_cap, hard_cap, soft_exceeded, hard_exceeded}
--   try_claim_budget_alert()  — atomic INSERT ON CONFLICT; returns true if this caller is first

-- ─── Alert dedup table ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.ai_budget_alerts (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  month       DATE        NOT NULL,
  level       TEXT        NOT NULL CHECK (level IN ('soft', 'hard')),
  notified_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (month, level)
);

-- No RLS — service_role only (accessed via service client in lib/ai/budget.ts)

-- ─── get_monthly_ai_spend ─────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_monthly_ai_spend()
RETURNS NUMERIC
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(SUM(estimated_cost_usd), 0)
  FROM public.ai_generations
  WHERE success = true
    AND created_at >= date_trunc('month', now());
$$;

GRANT EXECUTE ON FUNCTION public.get_monthly_ai_spend()
  TO service_role;

-- ─── check_global_ai_budget ───────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.check_global_ai_budget(
  p_soft_cap NUMERIC DEFAULT 50,
  p_hard_cap NUMERIC DEFAULT 100
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_spend NUMERIC;
BEGIN
  SELECT public.get_monthly_ai_spend() INTO v_spend;

  RETURN jsonb_build_object(
    'month_spend',   v_spend,
    'soft_cap',      p_soft_cap,
    'hard_cap',      p_hard_cap,
    'soft_exceeded', v_spend >= p_soft_cap,
    'hard_exceeded', v_spend >= p_hard_cap
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_global_ai_budget(NUMERIC, NUMERIC)
  TO service_role;

-- ─── try_claim_budget_alert ───────────────────────────────────────────────────
-- Atomically claims the alert slot for (current_month, level).
-- Returns TRUE  → caller is first; should send the alert.
-- Returns FALSE → already claimed this month; skip.

CREATE OR REPLACE FUNCTION public.try_claim_budget_alert(
  p_level TEXT
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_month DATE := date_trunc('month', now())::date;
  v_id    UUID;
BEGIN
  INSERT INTO public.ai_budget_alerts (month, level)
  VALUES (v_month, p_level)
  ON CONFLICT (month, level) DO NOTHING
  RETURNING id INTO v_id;

  RETURN v_id IS NOT NULL;
END;
$$;

GRANT EXECUTE ON FUNCTION public.try_claim_budget_alert(TEXT)
  TO service_role;
