-- Migration: 018_helper_functions
-- Refs: P1-05, docs/03-Database-Schema.md §4

-- ─── Function 1: validate_invite_code ────────────────────────────────────────
-- Atomically validates and consumes one use of an invite code.
-- Uses FOR UPDATE row-lock to prevent race conditions under concurrent signups.
CREATE OR REPLACE FUNCTION public.validate_invite_code(p_code TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id       uuid;
  v_max_uses int;
  v_use_count int;
  v_expires_at timestamptz;
BEGIN
  -- Lock the row for update to prevent concurrent double-use
  SELECT id, max_uses, use_count, expires_at
  INTO v_id, v_max_uses, v_use_count, v_expires_at
  FROM public.invite_codes
  WHERE code = p_code
  FOR UPDATE;

  -- Not found
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  -- Expired
  IF v_expires_at IS NOT NULL AND v_expires_at <= now() THEN
    RETURN FALSE;
  END IF;

  -- Exhausted (max_uses NULL = unlimited)
  IF v_max_uses IS NOT NULL AND v_use_count >= v_max_uses THEN
    RETURN FALSE;
  END IF;

  -- Consume one use
  UPDATE public.invite_codes
  SET use_count = use_count + 1
  WHERE id = v_id;

  RETURN TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.validate_invite_code(TEXT) TO authenticated, anon;

-- ─── Function 2: check_ai_quota ──────────────────────────────────────────────
-- Returns quota status for a user: lifetime (cap 10) and daily (cap 3).
CREATE OR REPLACE FUNCTION public.check_ai_quota(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lifetime_used int;
  v_daily_used    int;
  v_lifetime_cap  CONSTANT int := 10;
  v_daily_cap     CONSTANT int := 3;
  v_allowed       boolean;
  v_reason        text;
BEGIN
  SELECT COUNT(*)
  INTO v_lifetime_used
  FROM public.ai_generations
  WHERE user_id = p_user_id AND success = true;

  SELECT COUNT(*)
  INTO v_daily_used
  FROM public.ai_generations
  WHERE user_id = p_user_id
    AND success = true
    AND created_at > now() - interval '24 hours';

  v_allowed := (v_lifetime_used < v_lifetime_cap) AND (v_daily_used < v_daily_cap);

  IF v_lifetime_used >= v_lifetime_cap THEN
    v_reason := 'lifetime quota exceeded';
  ELSIF v_daily_used >= v_daily_cap THEN
    v_reason := 'daily quota exceeded';
  END IF;

  RETURN jsonb_build_object(
    'allowed',        v_allowed,
    'lifetime_used',  v_lifetime_used,
    'lifetime_cap',   v_lifetime_cap,
    'daily_used',     v_daily_used,
    'daily_cap',      v_daily_cap,
    'reason',         v_reason
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_ai_quota(UUID) TO authenticated;

-- ─── Function 3: compute_checkpoint_verdict ──────────────────────────────────
-- Returns 'green' | 'amber' | 'red' based on % deviation from target time.
-- green: result <= target (faster or equal)
-- amber: result 0–3% over target
-- red:   result > 3% over target
CREATE OR REPLACE FUNCTION public.compute_checkpoint_verdict(
  p_target_seconds INT,
  p_result_seconds INT
)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_pct_dev numeric;
BEGIN
  IF p_target_seconds IS NULL OR p_target_seconds <= 0 THEN
    RAISE EXCEPTION 'target_seconds must be a positive integer';
  END IF;

  v_pct_dev := (p_result_seconds - p_target_seconds)::numeric / p_target_seconds * 100;

  IF v_pct_dev <= 0 THEN
    RETURN 'green';
  ELSIF v_pct_dev <= 3.0 THEN
    RETURN 'amber';
  ELSE
    RETURN 'red';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.compute_checkpoint_verdict(INT, INT) TO authenticated;

-- ─── Function 4: handle_new_user (idempotent refresh) ────────────────────────
-- Already created in migration 001; redefining here to be idempotent.
-- Inserts profile row when auth.users row is inserted.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (NEW.id, NEW.email)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- Trigger already created in 001; CREATE OR REPLACE not supported for triggers — skip if exists.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'on_auth_user_created'
  ) THEN
    CREATE TRIGGER on_auth_user_created
      AFTER INSERT ON auth.users
      FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
  END IF;
END;
$$;

-- ─── Function 5: match_run_to_planned_session ─────────────────────────────────
-- Finds and links a run to its planned session by date-matching within active plan.
CREATE OR REPLACE FUNCTION public.match_run_to_planned_session(p_run_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id    uuid;
  v_run_date   date;
  v_session_id uuid;
BEGIN
  SELECT user_id, run_date INTO v_user_id, v_run_date
  FROM public.runs WHERE id = p_run_id;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  -- Find session in user's active plan matching run date
  SELECT ps.id INTO v_session_id
  FROM public.planned_sessions ps
  JOIN public.plans p ON p.id = ps.plan_id
  WHERE p.user_id = v_user_id
    AND p.status = 'active'
    AND ps.scheduled_date = v_run_date
  LIMIT 1;

  IF v_session_id IS NOT NULL THEN
    UPDATE public.runs
    SET planned_session_id = v_session_id
    WHERE id = p_run_id;
  END IF;

  RETURN v_session_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.match_run_to_planned_session(UUID) TO authenticated;
