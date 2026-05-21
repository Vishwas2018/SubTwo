-- Migration: 021_widen_session_type
-- Refs: DEV-006, docs/03-Database-Schema.md §2.5
-- Reason: planned_sessions.session_type CHECK excluded 'recovery' and 'marathon_pace',
-- which are valid values produced by GeneratedPlanSchema. Migration 020 worked around
-- this by remapping them. This migration widens the allowed set so AI values are
-- stored with full fidelity; migration 020's CASE remapping is also updated here.

-- Step 1: Drop the existing auto-named CHECK constraint
-- PostgreSQL names it <table>_<column>_check by default.
ALTER TABLE public.planned_sessions
  DROP CONSTRAINT IF EXISTS planned_sessions_session_type_check;

-- Step 2: Add widened constraint that includes all AI-generated types
ALTER TABLE public.planned_sessions
  ADD CONSTRAINT planned_sessions_session_type_check
  CHECK (session_type IN (
    'rest', 'easy', 'easy_strides', 'long_run', 'threshold',
    'interval', 'tempo', 'race_pace', 'time_trial', 'strength', 'race',
    'recovery', 'marathon_pace'
  ));

-- Step 3: Re-issue create_plan_from_generation with identity CASE (no remapping)
-- so future plan generations store AI session types verbatim.
CREATE OR REPLACE FUNCTION public.create_plan_from_generation(
  p_user_id      UUID,
  p_plan         JSONB,
  p_wizard       JSONB,
  p_generation_id UUID
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan_id       UUID;
  v_version_id    UUID;
  v_start_date    DATE;
  v_race_date     DATE;
  v_total_weeks   INT;
  v_session_count INT := 0;
  v_week          JSONB;
  v_session       JSONB;
  v_phase         TEXT;
  v_session_type  TEXT;
  v_pace_sec      NUMERIC;
  v_pace_min_km   NUMERIC;
BEGIN
  v_race_date   := (p_wizard->>'race_date')::date;
  v_total_weeks := (p_plan->>'total_weeks')::int;
  v_start_date  := v_race_date - (v_total_weeks * 7) + 1;

  INSERT INTO public.plans (
    user_id, status, race_distance_km, race_name, race_date, start_date,
    total_weeks, experience_level, baseline_data, goal_time_seconds, pace_zones
  )
  VALUES (
    p_user_id, 'draft',
    (p_wizard->>'race_distance_km')::numeric,
    p_wizard->>'race_name',
    v_race_date, v_start_date, v_total_weeks,
    p_wizard->>'experience_level',
    p_wizard,
    NULLIF(p_wizard->'wizard_data'->>'goal_time_seconds', '')::int,
    p_plan->'pace_zones'
  )
  RETURNING id INTO v_plan_id;

  INSERT INTO public.plan_versions (
    plan_id, version_number, generated_by, ai_generation_id, raw_plan_json
  )
  VALUES (v_plan_id, 1, 'ai', p_generation_id, p_plan)
  RETURNING id INTO v_version_id;

  UPDATE public.plans SET current_version_id = v_version_id WHERE id = v_plan_id;

  FOR v_week IN SELECT * FROM jsonb_array_elements(p_plan->'weeks') LOOP
    v_phase := lower(COALESCE(v_week->>'phase', 'base'));
    IF v_phase NOT IN ('base', 'build', 'peak', 'taper') THEN
      v_phase := 'base';
    END IF;

    FOR v_session IN SELECT * FROM jsonb_array_elements(v_week->'sessions') LOOP
      -- Store AI session type verbatim (constraint now accepts recovery + marathon_pace)
      v_session_type := v_session->>'session_type';

      v_pace_sec    := NULLIF(v_session->>'target_pace_seconds_per_km', '')::numeric;
      v_pace_min_km := CASE WHEN v_pace_sec IS NOT NULL THEN round(v_pace_sec / 60.0, 2) ELSE NULL END;

      INSERT INTO public.planned_sessions (
        plan_id, plan_version_id, week_number, day_of_week, scheduled_date,
        phase, session_type, distance_km, target_pace_min, target_pace_max,
        structure, focus, notes, is_deload, is_checkpoint, checkpoint_type
      )
      VALUES (
        v_plan_id, v_version_id,
        (v_week->>'week_number')::int,
        (v_session->>'day_of_week')::int,
        v_start_date
          + (((v_week->>'week_number')::int - 1) * 7)
          + ((v_session->>'day_of_week')::int - 1),
        v_phase, v_session_type,
        NULLIF(v_session->>'distance_km', '')::numeric,
        v_pace_min_km, v_pace_min_km,
        v_session->>'structure',
        v_session->>'focus',
        v_session->>'notes',
        COALESCE((v_week->>'is_deload')::boolean, false),
        false, NULL
      );
      v_session_count := v_session_count + 1;
    END LOOP;
  END LOOP;

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
      ORDER BY day_of_week LIMIT 1
    );

  RETURN jsonb_build_object(
    'plan_id', v_plan_id,
    'version_id', v_version_id,
    'session_count', v_session_count
  );

EXCEPTION WHEN OTHERS THEN
  RAISE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_plan_from_generation(UUID, JSONB, JSONB, UUID)
  TO authenticated, service_role;
