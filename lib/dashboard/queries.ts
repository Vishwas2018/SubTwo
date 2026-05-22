import { createClient } from '@/lib/supabase/server';
import { computeAlerts, daysBetween } from './alert-rules';
import { melbourneToday } from '@/lib/plans/view-helpers';
import type { Alert } from './alert-rules';
import type { Database } from '@/types/database.types';

type PlannedSession = Database['public']['Tables']['planned_sessions']['Row'];
type PaceZoneJson = { max_seconds_per_km: number; min_seconds_per_km: number } | null;
type PaceZonesJson = { easy?: PaceZoneJson } | null;

export type WeekProgress = {
  week_number: number;
  phase: string;
  planned_km: number;
  completed_km: number;
  sessions_planned: number;
  sessions_completed: number;
};

export type NextSession = {
  id: string;
  session_type: string;
  scheduled_date: string;
  distance_km: number | null;
  focus: string | null;
  phase: string;
};

export type Trend4w = {
  label: string;
  weekly_km: number[];
  avg_easy_pace: (number | null)[];
  avg_sleep: (number | null)[];
  avg_rhr: (number | null)[];
};

export type Readiness = {
  last_verdict: string | null;
  last_checkpoint_type: string | null;
};

export type DashboardData = {
  current_week: WeekProgress | null;
  next_session: NextSession | null;
  trends_4w: Trend4w;
  alerts: Alert[];
  readiness: Readiness;
  active_niggles_count: number;
};

/** Derive the plan week number for a given calendar date. */
function planWeekNumber(startDate: string, targetDate: string): number {
  const diff = daysBetween(startDate, targetDate);
  return Math.max(1, Math.floor(diff / 7) + 1);
}

/** YYYY-MM-DD string for N days before a given date. */
function daysAgo(date: string, n: number): string {
  const d = new Date(date + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().split('T')[0]!;
}

/** Week label for trend display (e.g. "Wk 5"). */
function weekLabel(startDate: string, weekStartDate: string): string {
  const wk = planWeekNumber(startDate, weekStartDate);
  return `Wk ${wk}`;
}

export async function getDashboardData(userId: string): Promise<DashboardData | null> {
  const supabase = await createClient();

  // ── 1. Active plan ──────────────────────────────────────────────────
  const { data: plan, error: planErr } = await supabase
    .from('plans')
    .select('id, start_date, race_date, total_weeks, current_version_id, pace_zones')
    .eq('user_id', userId)
    .eq('status', 'active')
    .single();

  if (planErr || !plan) return null;

  const today = melbourneToday();
  const currentWeekNum = planWeekNumber(plan.start_date, today);

  // ── 2. Current-week sessions ─────────────────────────────────────────
  const { data: weekSessions } = await supabase
    .from('planned_sessions')
    .select('*')
    .eq('plan_id', plan.id)
    .eq('plan_version_id', plan.current_version_id ?? '')
    .eq('week_number', currentWeekNum)
    .neq('session_type', 'rest')
    .order('day_of_week', { ascending: true });

  const sessionIds = (weekSessions ?? []).map((s) => s.id);

  // ── 3. Runs linked to current-week sessions ──────────────────────────
  const { data: weekRuns } = sessionIds.length
    ? await supabase
        .from('runs')
        .select('id, planned_session_id, distance_km')
        .in('planned_session_id', sessionIds)
        .is('deleted_at', null)
    : { data: [] };

  const completedSessionIds = new Set((weekRuns ?? []).map((r) => r.planned_session_id));

  const plannedKm = (weekSessions ?? []).reduce((s, sess) => s + (sess.distance_km ?? 0), 0);
  const completedKm = (weekRuns ?? []).reduce((s, r) => s + r.distance_km, 0);
  const sessPhase = (weekSessions ?? [])[0]?.phase ?? 'base';

  const currentWeek: WeekProgress = {
    week_number: currentWeekNum,
    phase: sessPhase,
    planned_km: Math.round(plannedKm * 10) / 10,
    completed_km: Math.round(completedKm * 10) / 10,
    sessions_planned: (weekSessions ?? []).length,
    sessions_completed: (weekSessions ?? []).filter((s) => completedSessionIds.has(s.id)).length,
  };

  // ── 4. Next upcoming session ─────────────────────────────────────────
  const { data: nextSessions } = await supabase
    .from('planned_sessions')
    .select('id, session_type, scheduled_date, distance_km, focus, phase')
    .eq('plan_id', plan.id)
    .eq('plan_version_id', plan.current_version_id ?? '')
    .neq('session_type', 'rest')
    .gte('scheduled_date', today)
    .not('id', 'in', sessionIds.length ? `(${sessionIds.filter((id) => completedSessionIds.has(id)).join(',')})` : '(null)')
    .order('scheduled_date', { ascending: true })
    .limit(1);

  // fallback: first non-completed, non-rest session from today onward
  const { data: upcomingRaw } = await supabase
    .from('planned_sessions')
    .select('id, session_type, scheduled_date, distance_km, focus, phase, plan_version_id')
    .eq('plan_id', plan.id)
    .eq('plan_version_id', plan.current_version_id ?? '')
    .neq('session_type', 'rest')
    .gte('scheduled_date', today)
    .order('scheduled_date', { ascending: true })
    .limit(10);

  const upcoming = (upcomingRaw ?? []).find((s) => !completedSessionIds.has(s.id));
  const nextSession: NextSession | null = upcoming
    ? {
        id: upcoming.id,
        session_type: upcoming.session_type,
        scheduled_date: upcoming.scheduled_date,
        distance_km: upcoming.distance_km,
        focus: upcoming.focus,
        phase: upcoming.phase,
      }
    : null;

  // ── 5. Last 4 weeks of runs for trends ───────────────────────────────
  const fourWeeksAgo = daysAgo(today, 28);
  const { data: recentRuns } = await supabase
    .from('runs')
    .select(
      'id, run_date, distance_km, avg_pace_seconds, planned_session_id',
    )
    .eq('user_id', userId)
    .is('deleted_at', null)
    .gte('run_date', fourWeeksAgo)
    .order('run_date', { ascending: false });

  // ── 6. Planned session types for the runs (for easy-pace detection) ──
  const runWithSessionIds = (recentRuns ?? [])
    .filter((r) => r.planned_session_id !== null)
    .map((r) => r.planned_session_id!);

  const { data: sessionTypes } = runWithSessionIds.length
    ? await supabase
        .from('planned_sessions')
        .select('id, session_type')
        .in('id', runWithSessionIds)
    : { data: [] };

  const sessionTypeMap = new Map(
    (sessionTypes ?? []).map((s) => [s.id, s.session_type]),
  );

  // ── 7. Last 4 weeks of check-ins for trends ──────────────────────────
  const { data: recentCheckins } = await supabase
    .from('daily_checkins')
    .select('checkin_date, sleep_hours, resting_hr')
    .eq('user_id', userId)
    .gte('checkin_date', fourWeeksAgo)
    .order('checkin_date', { ascending: false });

  // ── 8. Build 4-week trend buckets ────────────────────────────────────
  const weekBuckets = buildWeekBuckets(today, 4);

  const trends4w: Trend4w = {
    label: 'Last 4 weeks',
    weekly_km: weekBuckets.map((bucket) =>
      (recentRuns ?? [])
        .filter((r) => r.run_date >= bucket.start && r.run_date <= bucket.end)
        .reduce((s, r) => s + r.distance_km, 0),
    ),
    avg_easy_pace: weekBuckets.map((bucket) => {
      const easyPaces = (recentRuns ?? [])
        .filter(
          (r) =>
            r.run_date >= bucket.start &&
            r.run_date <= bucket.end &&
            r.avg_pace_seconds !== null &&
            r.planned_session_id !== null &&
            sessionTypeMap.get(r.planned_session_id!) === 'easy',
        )
        .map((r) => r.avg_pace_seconds!);
      if (easyPaces.length === 0) return null;
      return Math.round(easyPaces.reduce((s, p) => s + p, 0) / easyPaces.length);
    }),
    avg_sleep: weekBuckets.map((bucket) => {
      const hours = (recentCheckins ?? [])
        .filter(
          (c) =>
            c.checkin_date >= bucket.start &&
            c.checkin_date <= bucket.end &&
            c.sleep_hours !== null,
        )
        .map((c) => c.sleep_hours!);
      if (hours.length === 0) return null;
      return Math.round((hours.reduce((s, h) => s + h, 0) / hours.length) * 10) / 10;
    }),
    avg_rhr: weekBuckets.map((bucket) => {
      const hrs = (recentCheckins ?? [])
        .filter(
          (c) =>
            c.checkin_date >= bucket.start &&
            c.checkin_date <= bucket.end &&
            c.resting_hr !== null,
        )
        .map((c) => c.resting_hr!);
      if (hrs.length === 0) return null;
      return Math.round(hrs.reduce((s, h) => s + h, 0) / hrs.length);
    }),
  };

  // ── 9. Alert inputs ──────────────────────────────────────────────────
  // Last 3 easy run paces (most recent first)
  const recentEasyPaces = (recentRuns ?? [])
    .filter(
      (r) =>
        r.avg_pace_seconds !== null &&
        r.planned_session_id !== null &&
        sessionTypeMap.get(r.planned_session_id!) === 'easy',
    )
    .slice(0, 3)
    .map((r) => r.avg_pace_seconds!);

  const paceZonesJson = plan.pace_zones as PaceZonesJson;
  const easyCeiling = paceZonesJson?.easy?.max_seconds_per_km ?? null;

  // Last 3 check-in sleep hours (most recent first)
  const recentSleep = (recentCheckins ?? [])
    .filter((c) => c.sleep_hours !== null)
    .slice(0, 3)
    .map((c) => c.sleep_hours!);

  // ── 10. Active niggles ───────────────────────────────────────────────
  const { data: niggles } = await supabase
    .from('niggles')
    .select('started_date')
    .eq('user_id', userId)
    .is('resolved_date', null);

  const activeDays = (niggles ?? []).map((n) => daysBetween(n.started_date, today));

  const alerts = computeAlerts({
    recentEasyPaces,
    easyCeilingSec: easyCeiling,
    recentSleepHours: recentSleep,
    activeDaysPerNiggle: activeDays,
  });

  // ── 11. Readiness (last checkpoint) ─────────────────────────────────
  const { data: checkpoints } = await supabase
    .from('checkpoints')
    .select('verdict, checkpoint_type')
    .eq('user_id', userId)
    .order('actual_date', { ascending: false })
    .limit(1);

  const lastCheckpoint = (checkpoints ?? [])[0] ?? null;
  const readiness: Readiness = {
    last_verdict: lastCheckpoint?.verdict ?? null,
    last_checkpoint_type: lastCheckpoint?.checkpoint_type ?? null,
  };

  return {
    current_week: currentWeek,
    next_session: nextSession,
    trends_4w: trends4w,
    alerts,
    readiness,
    active_niggles_count: (niggles ?? []).length,
  };
}

type WeekBucket = { start: string; end: string };

/** Build N weekly buckets ending on today (inclusive). Each bucket is Mon–Sun aligned. */
function buildWeekBuckets(today: string, n: number): WeekBucket[] {
  const buckets: WeekBucket[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const end = daysAgo(today, i * 7);
    const start = daysAgo(end, 6);
    buckets.push({ start, end });
  }
  return buckets;
}
