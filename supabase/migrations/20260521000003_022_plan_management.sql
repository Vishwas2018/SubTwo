-- Migration: 022_plan_management
-- Refs: P2-06, docs/03-Database-Schema.md §2.3-2.5
-- Adds two SECURITY DEFINER helpers:
--   activate_plan   — archives existing active plan, promotes draft→active
--   create_plan_version — inserts a new AI-generated version on an existing plan

-- ─── activate_plan ────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.activate_plan(
  p_plan_id UUID,
  p_user_id UUID
) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Archive any existing active plan for this user (enforces single active plan)
  UPDATE public.plans
  SET status = 'archived'
  WHERE user_id = p_user_id
    AND status  = 'active'
    AND id     != p_plan_id;

  -- Promote target plan draft→active
  UPDATE public.plans
  SET status = 'active', activated_at = now()
  WHERE id      = p_plan_id
    AND user_id = p_user_id
    AND status  = 'draft';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Plan % not found, not owned by user, or not in draft status', p_plan_id;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.activate_plan(UUID, UUID)
  TO authenticated, service_role;

-- ─── create_plan_version ──────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.create_plan_version(
  p_plan_id       UUID,
  p_plan          JSONB,
  p_generation_id UUID
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_version_id     UUID;
  v_version_number INT;
  v_start_date     DATE;
  v_race_date      DATE;
  v_total_weeks    INT;
  v_session_count  INT := 0;
  v_week           JSONB;
  v_session        JSONB;
  v_phase          TEXT;
  v_session_type   TEXT;
  v_pace_sec       NUMERIC;
  v_pace_min_km    NUMERIC;
BEGIN
  -- Race date stays fixed; total_weeks may differ in the new version
  SELECT race_date INTO v_race_date
  FROM public.plans WHERE id = p_plan_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Plan % not found', p_plan_id;
  END IF;

  v_total_weeks := (p_plan->>'total_weeks')::int;
  v_start_date  := v_race_date - (v_total_weeks * 7) + 1;

  -- Determine next version number
  SELECT COALESCE(MAX(version_number), 0) + 1
  INTO v_version_number
  FROM public.plan_versions
  WHERE plan_id = p_plan_id;

  -- Insert new version record
  INSERT INTO public.plan_versions (
    plan_id, version_number, generated_by, ai_generation_id, raw_plan_json
  )
  VALUES (p_plan_id, v_version_number, 'ai', p_generation_id, p_plan)
  RETURNING id INTO v_version_id;

  -- Update plan: point to new version, refresh total_weeks + pace_zones
  UPDATE public.plans
  SET current_version_id = v_version_id,
      total_weeks        = v_total_weeks,
      pace_zones         = p_plan->'pace_zones'
  WHERE id = p_plan_id;

  -- Insert sessions for the new version
  FOR v_week IN SELECT * FROM jsonb_array_elements(p_plan->'weeks') LOOP
    v_phase := lower(COALESCE(v_week->>'phase', 'base'));
    IF v_phase NOT IN ('base', 'build', 'peak', 'taper') THEN
      v_phase := 'base';
    END IF;

    FOR v_session IN SELECT * FROM jsonb_array_elements(v_week->'sessions') LOOP
      v_session_type := v_session->>'session_type';
      v_pace_sec     := NULLIF(v_session->>'target_pace_seconds_per_km', '')::numeric;
      v_pace_min_km  := CASE WHEN v_pace_sec IS NOT NULL
                             THEN round(v_pace_sec / 60.0, 2)
                             ELSE NULL END;

      INSERT INTO public.planned_sessions (
        plan_id, plan_version_id, week_number, day_of_week, scheduled_date,
        phase, session_type, distance_km, target_pace_min, target_pace_max,
        structure, focus, notes, is_deload, is_checkpoint, checkpoint_type
      )
      VALUES (
        p_plan_id,
        v_version_id,
        (v_week->>'week_number')::int,
        (v_session->>'day_of_week')::int,
        v_start_date
          + (((v_week->>'week_number')::int - 1) * 7)
          + ((v_session->>'day_of_week')::int - 1),
        v_phase,
        v_session_type,
        NULLIF(v_session->>'distance_km', '')::numeric,
        v_pace_min_km,
        v_pace_min_km,
        v_session->>'structure',
        v_session->>'focus',
        v_session->>'notes',
        COALESCE((v_week->>'is_deload')::boolean, false),
        false,
        NULL
      );
      v_session_count := v_session_count + 1;
    END LOOP;
  END LOOP;

  -- Flag first time_trial/race session in each checkpoint week
  UPDATE public.planned_sessions ps
  SET
    is_checkpoint   = true,
    checkpoint_type = (
      SELECT cp->>'type'
      FROM jsonb_array_elements(p_plan->'checkpoints') AS cp
      WHERE (cp->>'week')::int = ps.week_number
      LIMIT 1
    )
  WHERE ps.plan_version_id = v_version_id
    AND ps.session_type IN ('time_trial', 'race')
    AND EXISTS (
      SELECT 1 FROM jsonb_array_elements(p_plan->'checkpoints') AS cp
      WHERE (cp->>'week')::int = ps.week_number
    )
    AND ps.id = (
      SELECT id FROM public.planned_sessions
      WHERE plan_version_id = v_version_id
        AND week_number = ps.week_number
        AND session_type IN ('time_trial', 'race')
      ORDER BY day_of_week
      LIMIT 1
    );

  RETURN jsonb_build_object(
    'plan_id',        p_plan_id,
    'version_id',     v_version_id,
    'version_number', v_version_number,
    'session_count',  v_session_count
  );

EXCEPTION WHEN OTHERS THEN
  RAISE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_plan_version(UUID, JSONB, UUID)
  TO authenticated, service_role;
