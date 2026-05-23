/**
 * POST /api/cron/adjustments
 * Nightly Vercel Cron (0 17 * * * UTC = 3am AEST) that evaluates the 6
 * adjustment rules for every active plan and applies any triggered actions.
 * Auth: Bearer CRON_SECRET header.
 * Refs: P3-05
 */

import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { logAudit } from '@/lib/audit/log';
import { evaluateAdjustments, type AdjustmentContext } from '@/lib/adjustment-rules';
import { applyAdjustment } from '@/lib/adjustments/apply';
import type { Json } from '@/types/database.types';

type PaceZonesJson = {
  threshold?: { max_seconds_per_km?: number };
};

function extractThresholdPace(paceZones: Json): number | null {
  const zones = paceZones as PaceZonesJson | null;
  return zones?.threshold?.max_seconds_per_km ?? null;
}

function subtractDays(date: string, days: number): string {
  const d = new Date(date + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

export async function POST(req: Request) {
  // ── 1. Verify CRON_SECRET ─────────────────────────────────────────────────
  const authHeader = req.headers.get('authorization');
  const secret = process.env.CRON_SECRET;
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: { code: 'unauthorized', message: 'Invalid cron secret.' } }, { status: 401 });
  }

  const svc = createServiceClient();
  const today = new Date().toISOString().slice(0, 10);

  // ── 2. Load all active plans ──────────────────────────────────────────────
  const { data: plans, error: plansErr } = await svc
    .from('plans')
    .select('id, user_id, pace_zones')
    .eq('status', 'active');

  if (plansErr) {
    return NextResponse.json(
      { error: { code: 'server_error', message: 'Failed to load active plans.' } },
      { status: 500 },
    );
  }

  if (!plans || plans.length === 0) {
    return NextResponse.json({ data: { plans_checked: 0, adjustments_applied: 0 } });
  }

  let adjustmentsApplied = 0;
  const windowStart = subtractDays(today, 7);
  // Load runs from a wider window to ensure enough easy runs for the pace check
  const runsWindowStart = subtractDays(today, 21);

  for (const plan of plans) {
    // ── 3. Load 7-day data window for this plan ──────────────────────────────
    const [
      { data: sessions },
      { data: runs },
      { data: checkins },
      { data: niggles },
      { data: checkpoints },
    ] = await Promise.all([
      svc
        .from('planned_sessions')
        .select('id, session_type, scheduled_date, week_number, distance_km, target_pace_min, target_pace_max, is_deload')
        .eq('plan_id', plan.id)
        .gte('scheduled_date', windowStart),
      svc
        .from('runs')
        .select('id, run_date, avg_pace_seconds, planned_session_id')
        .eq('user_id', plan.user_id)
        .gte('run_date', runsWindowStart)
        .is('deleted_at', null),
      svc
        .from('daily_checkins')
        .select('checkin_date, sleep_hours, resting_hr')
        .eq('user_id', plan.user_id)
        .gte('checkin_date', windowStart)
        .order('checkin_date', { ascending: false }),
      svc
        .from('niggles')
        .select('id, started_date, resolved_date, body_part')
        .eq('user_id', plan.user_id)
        .is('resolved_date', null),
      svc
        .from('checkpoints')
        .select('id, verdict, target_week, created_at')
        .eq('plan_id', plan.id)
        .order('created_at', { ascending: false })
        .limit(3),
    ]);

    const runsBySessionId = new Set(
      (runs ?? []).map((r) => r.planned_session_id).filter((id): id is string => id !== null),
    );

    const ctx: AdjustmentContext = {
      today,
      sessions: (sessions ?? []).map((s) => ({
        id: s.id,
        session_type: s.session_type,
        scheduled_date: s.scheduled_date,
        week_number: s.week_number,
        distance_km: s.distance_km ?? null,
        target_pace_min: s.target_pace_min ?? null,
        target_pace_max: s.target_pace_max ?? null,
        is_deload: s.is_deload,
        has_run: runsBySessionId.has(s.id),
      })),
      runs: (runs ?? []).map((r) => ({
        id: r.id,
        run_date: r.run_date,
        avg_pace_seconds: r.avg_pace_seconds ?? null,
        planned_session_id: r.planned_session_id ?? null,
      })),
      checkins: (checkins ?? []).map((c) => ({
        checkin_date: c.checkin_date,
        sleep_hours: c.sleep_hours ?? null,
        resting_hr: c.resting_hr ?? null,
      })),
      niggles: (niggles ?? []).map((n) => ({
        id: n.id,
        started_date: n.started_date,
        resolved_date: n.resolved_date ?? null,
        body_part: n.body_part,
      })),
      checkpoints: (checkpoints ?? []).map((cp) => ({
        id: cp.id,
        verdict: cp.verdict,
        target_week: cp.target_week,
        created_at: cp.created_at,
      })),
      thresholdPaceSec: extractThresholdPace(plan.pace_zones),
    };

    // ── 4. Evaluate all 6 rules ───────────────────────────────────────────────
    const actions = evaluateAdjustments(ctx);

    // ── 5. Apply each triggered action ────────────────────────────────────────
    for (const action of actions) {
      const adjId = await applyAdjustment(plan.id, action);
      if (adjId) {
        adjustmentsApplied++;
        await logAudit({
          action: 'adjustment_applied',
          entityType: 'plan_adjustments',
          entityId: adjId,
          metadata: { trigger: action.trigger, plan_id: plan.id, change_summary: action.change_summary },
          userId: plan.user_id,
        });
      }
    }
  }

  return NextResponse.json({
    data: {
      plans_checked: plans.length,
      adjustments_applied: adjustmentsApplied,
    },
  });
}
