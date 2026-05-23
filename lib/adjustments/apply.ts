/**
 * Applies an AdjustmentAction to a plan's planned_sessions and records it in
 * plan_adjustments. All writes are idempotent: if the same trigger has already
 * been applied within the last 7 days (and not overridden), this is a no-op.
 * Refs: P3-04, P3-05
 */

import { createServiceClient } from '@/lib/supabase/server';
import {
  type AdjustmentAction,
  DELOAD_FACTOR,
  QUALITY_INTENSITY_REDUCTION,
} from '@/lib/adjustment-rules';

const QUALITY_SESSION_TYPES = ['threshold', 'interval', 'tempo', 'race_pace'];

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

function sevenDaysAgoUtc(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 7);
  return d.toISOString().slice(0, 10);
}

/**
 * Apply a single AdjustmentAction to the given plan.
 * Returns the new plan_adjustments row id, or null if already applied (idempotent).
 */
export async function applyAdjustment(
  planId: string,
  action: AdjustmentAction,
): Promise<string | null> {
  const svc = createServiceClient();

  // ── Idempotency: skip if same trigger already applied this window ──────────
  const { data: existing } = await svc
    .from('plan_adjustments')
    .select('id')
    .eq('plan_id', planId)
    .eq('trigger', action.trigger)
    .eq('user_override', false)
    .gte('created_at', sevenDaysAgoUtc() + 'T00:00:00Z')
    .maybeSingle();

  if (existing) return null;

  const today = todayUtc();
  const affectedIds: string[] = [];
  const originalValues: Record<string, { distance_km: number | null; is_deload: boolean }> = {};
  const details = action.change_details as Record<string, unknown>;

  // ── Deload next week (missed_sessions rule) ───────────────────────────────
  if (details.deload_next_week === true) {
    const { data: upcoming } = await svc
      .from('planned_sessions')
      .select('id, week_number, distance_km, is_deload')
      .eq('plan_id', planId)
      .gt('scheduled_date', today)
      .order('week_number', { ascending: true });

    if (upcoming && upcoming.length > 0) {
      const nextWeek = upcoming[0]!.week_number;
      const nextWeekSessions = upcoming.filter((s) => s.week_number === nextWeek);

      for (const s of nextWeekSessions) {
        originalValues[s.id] = { distance_km: s.distance_km, is_deload: s.is_deload };
        const newDist =
          s.distance_km !== null
            ? Math.round(s.distance_km * DELOAD_FACTOR * 10) / 10
            : null;
        await svc
          .from('planned_sessions')
          .update({ distance_km: newDist, is_deload: true })
          .eq('id', s.id);
        affectedIds.push(s.id);
      }
    }
  }

  // ── Deload next quality session (rhr_elevated rule) ───────────────────────
  if (details.deload_next_quality === true) {
    const { data: upcoming } = await svc
      .from('planned_sessions')
      .select('id, session_type, distance_km, target_pace_min, target_pace_max, is_deload')
      .eq('plan_id', planId)
      .gt('scheduled_date', today)
      .in('session_type', QUALITY_SESSION_TYPES)
      .order('scheduled_date', { ascending: true })
      .limit(1);

    const next = upcoming?.[0];
    if (next) {
      originalValues[next.id] = { distance_km: next.distance_km, is_deload: next.is_deload };
      const newDist =
        next.distance_km !== null
          ? Math.round(next.distance_km * DELOAD_FACTOR * 10) / 10
          : null;
      await svc
        .from('planned_sessions')
        .update({ distance_km: newDist, is_deload: true })
        .eq('id', next.id);
      affectedIds.push(next.id);
    }
  }

  // ── Reduce next quality intensity 20% (sleep_deficit rule) ───────────────
  if (details.reduce_next_quality === true) {
    const { data: upcoming } = await svc
      .from('planned_sessions')
      .select('id, session_type, distance_km, target_pace_min, target_pace_max, is_deload')
      .eq('plan_id', planId)
      .gt('scheduled_date', today)
      .in('session_type', QUALITY_SESSION_TYPES)
      .order('scheduled_date', { ascending: true })
      .limit(1);

    const next = upcoming?.[0];
    if (next) {
      originalValues[next.id] = { distance_km: next.distance_km, is_deload: next.is_deload };
      const newDist =
        next.distance_km !== null
          ? Math.round(next.distance_km * QUALITY_INTENSITY_REDUCTION * 10) / 10
          : null;
      await svc
        .from('planned_sessions')
        .update({ distance_km: newDist })
        .eq('id', next.id);
      affectedIds.push(next.id);
    }
  }

  // ── advisory_only / suggest_cross_train / offer_regen: no session changes ─
  // (niggle_persistent, easy_too_fast, checkpoint_red are flags only)

  // ── Insert plan_adjustments row ────────────────────────────────────────────
  const { data: adj, error } = await svc
    .from('plan_adjustments')
    .insert({
      plan_id: planId,
      trigger: action.trigger,
      change_summary: action.change_summary,
      affected_session_ids: affectedIds.length > 0 ? affectedIds : null,
      change_details: {
        ...action.change_details,
        original_values: Object.keys(originalValues).length > 0 ? originalValues : undefined,
      },
      user_override: false,
    })
    .select('id')
    .single();

  if (error || !adj) return null;
  return adj.id as string;
}

/**
 * Revert an adjustment: restore original session values and mark user_override=true.
 * Returns true if reverted, false if already overridden or not found.
 */
export async function revertAdjustment(adjId: string, planId: string): Promise<boolean> {
  const svc = createServiceClient();

  const { data: adj } = await svc
    .from('plan_adjustments')
    .select('*')
    .eq('id', adjId)
    .eq('plan_id', planId)
    .single();

  if (!adj || adj.user_override) return false;

  const details = adj.change_details as Record<string, unknown> | null;
  const originals = details?.original_values as
    | Record<string, { distance_km: number | null; is_deload: boolean }>
    | undefined;

  if (originals) {
    for (const [sessionId, orig] of Object.entries(originals)) {
      await svc
        .from('planned_sessions')
        .update({ distance_km: orig.distance_km, is_deload: orig.is_deload })
        .eq('id', sessionId);
    }
  }

  await svc.from('plan_adjustments').update({ user_override: true }).eq('id', adjId);
  return true;
}
