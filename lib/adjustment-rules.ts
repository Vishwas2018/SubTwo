/**
 * Deterministic adjustment rules for SubTwo training plans.
 * All functions are pure — no DB calls, no side effects.
 * Refs: P3-04, PRD §3.5, ADR-008 (no AI, pure + testable)
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export type AdjustmentTrigger =
  | 'missed_sessions'
  | 'rhr_elevated'
  | 'niggle_persistent'
  | 'easy_too_fast'
  | 'sleep_deficit'
  | 'checkpoint_red';

export type AdjustmentAction = {
  trigger: AdjustmentTrigger;
  change_summary: string;
  affected_session_ids: string[];
  change_details: Record<string, unknown>;
};

export type SessionWindow = {
  id: string;
  session_type: string;
  scheduled_date: string;
  week_number: number;
  distance_km: number | null;
  target_pace_min: number | null;
  target_pace_max: number | null;
  is_deload: boolean;
  has_run: boolean;
};

export type RunWindow = {
  id: string;
  run_date: string;
  avg_pace_seconds: number | null;
  planned_session_id: string | null;
};

export type CheckinWindow = {
  checkin_date: string;
  sleep_hours: number | null;
  resting_hr: number | null;
};

export type NiggleWindow = {
  id: string;
  started_date: string;
  resolved_date: string | null;
  body_part: string;
};

export type CheckpointWindow = {
  id: string;
  verdict: string;
  target_week: number;
  created_at: string;
};

export type AdjustmentContext = {
  today: string;
  sessions: SessionWindow[];
  runs: RunWindow[];
  checkins: CheckinWindow[];
  niggles: NiggleWindow[];
  checkpoints: CheckpointWindow[];
  thresholdPaceSec?: number | null;
};

// ─── Threshold constants ──────────────────────────────────────────────────────

export const MISSED_SESSION_THRESHOLD = 2;
export const RHR_ELEVATION_BPM = 5;
export const RHR_CONSECUTIVE_DAYS = 3;
export const NIGGLE_DAYS_THRESHOLD = 5;
export const EASY_PACE_GAP_SEC = 7;
export const SLEEP_HOURS_THRESHOLD = 7;
export const SLEEP_WINDOW_DAYS = 3;
export const DELOAD_FACTOR = 0.65;
export const QUALITY_INTENSITY_REDUCTION = 0.8;
export const KEY_SESSION_TYPES = [
  'threshold',
  'interval',
  'tempo',
  'long_run',
  'race_pace',
] as const;

// ─── Local date helpers ───────────────────────────────────────────────────────

function daysBetween(startDate: string, endDate: string): number {
  const start = new Date(startDate + 'T00:00:00Z');
  const end = new Date(endDate + 'T00:00:00Z');
  return Math.max(0, Math.round((end.getTime() - start.getTime()) / 86_400_000));
}

function subtractDays(date: string, days: number): string {
  const d = new Date(date + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

// ─── Rule 1: Missed sessions ──────────────────────────────────────────────────

/**
 * Fires when ≥2 key sessions (threshold/interval/tempo/long_run/race_pace) were
 * missed in the last 7 days. Suggests a deload for the following week.
 */
export function checkMissedSessions(
  sessions: SessionWindow[],
  today: string,
): AdjustmentAction | null {
  const windowStart = subtractDays(today, 7);
  const missed = sessions.filter(
    (s) =>
      (KEY_SESSION_TYPES as ReadonlyArray<string>).includes(s.session_type) &&
      s.scheduled_date >= windowStart &&
      s.scheduled_date < today &&
      !s.has_run,
  );

  if (missed.length >= MISSED_SESSION_THRESHOLD) {
    return {
      trigger: 'missed_sessions',
      change_summary: `${missed.length} key sessions missed in last 7 days — deload next week`,
      affected_session_ids: [],
      change_details: {
        missed_count: missed.length,
        missed_session_ids: missed.map((s) => s.id),
        deload_next_week: true,
      },
    };
  }
  return null;
}

// ─── Rule 2: RHR elevated ────────────────────────────────────────────────────

/**
 * Fires when RHR is >5 bpm above the check-in window baseline for the 3 most
 * recent consecutive days. Suggests deloading the next quality session.
 */
export function checkRhrElevated(checkins: CheckinWindow[]): AdjustmentAction | null {
  const withHr = [...checkins]
    .filter((c) => c.resting_hr !== null)
    .sort((a, b) => b.checkin_date.localeCompare(a.checkin_date));

  if (withHr.length < RHR_CONSECUTIVE_DAYS + 1) return null;

  const baseline =
    withHr.reduce((sum, c) => sum + c.resting_hr!, 0) / withHr.length;
  const last3 = withHr.slice(0, RHR_CONSECUTIVE_DAYS);
  const allElevated = last3.every((c) => c.resting_hr! > baseline + RHR_ELEVATION_BPM);

  if (allElevated) {
    return {
      trigger: 'rhr_elevated',
      change_summary: `RHR elevated >${RHR_ELEVATION_BPM} bpm above baseline for ${RHR_CONSECUTIVE_DAYS}+ consecutive days — deload next quality session`,
      affected_session_ids: [],
      change_details: {
        baseline_rhr: Math.round(baseline),
        recent_rhrs: last3.map((c) => c.resting_hr),
        deload_next_quality: true,
      },
    };
  }
  return null;
}

// ─── Rule 3: Persistent niggle ────────────────────────────────────────────────

/**
 * Fires when any active niggle has been present for ≥5 days.
 * Suggests swapping the next quality session for a cross-train session.
 */
export function checkNigglePersistent(
  niggles: NiggleWindow[],
  today: string,
): AdjustmentAction | null {
  const persistent = niggles.filter(
    (n) => n.resolved_date === null && daysBetween(n.started_date, today) >= NIGGLE_DAYS_THRESHOLD,
  );

  if (persistent.length > 0) {
    const worst = persistent[0]!;
    return {
      trigger: 'niggle_persistent',
      change_summary: `Niggle (${worst.body_part}) active for ${daysBetween(worst.started_date, today)} days — suggest cross-train swap for next quality session`,
      affected_session_ids: [],
      change_details: {
        niggle_ids: persistent.map((n) => n.id),
        niggle_body_parts: persistent.map((n) => n.body_part),
        suggest_cross_train: true,
      },
    };
  }
  return null;
}

// ─── Rule 4: Easy runs too fast ───────────────────────────────────────────────

/**
 * Advisory-only. Fires when the last 3 easy/recovery runs are all within 7 s/km
 * of the threshold zone ceiling (i.e. athlete is running easy days too fast).
 * No session changes — advisory flag only.
 */
export function checkEasyTooFast(
  runs: RunWindow[],
  sessions: SessionWindow[],
  thresholdPaceSec: number,
): AdjustmentAction | null {
  const easyIds = new Set(
    sessions
      .filter((s) => s.session_type === 'easy' || s.session_type === 'recovery')
      .map((s) => s.id),
  );

  const easyRuns = [...runs]
    .filter(
      (r) =>
        r.planned_session_id !== null &&
        easyIds.has(r.planned_session_id) &&
        r.avg_pace_seconds !== null,
    )
    .sort((a, b) => b.run_date.localeCompare(a.run_date))
    .slice(0, 3);

  if (easyRuns.length < 3) return null;

  const allTooFast = easyRuns.every(
    (r) => r.avg_pace_seconds! <= thresholdPaceSec + EASY_PACE_GAP_SEC,
  );

  if (allTooFast) {
    return {
      trigger: 'easy_too_fast',
      change_summary:
        'Last 3 easy runs within 7 s/km of threshold pace — advisory: keep easy days easy',
      affected_session_ids: [],
      change_details: {
        avg_paces_sec: easyRuns.map((r) => r.avg_pace_seconds),
        threshold_ceiling_sec: thresholdPaceSec,
        advisory_only: true,
      },
    };
  }
  return null;
}

// ─── Rule 5: Sleep deficit ────────────────────────────────────────────────────

/**
 * Fires when average sleep over the last 3 check-ins is < 7h.
 * Suggests reducing the next quality session's intensity by 20%.
 */
export function checkSleepDeficit(checkins: CheckinWindow[]): AdjustmentAction | null {
  const withSleep = [...checkins]
    .filter((c) => c.sleep_hours !== null)
    .sort((a, b) => b.checkin_date.localeCompare(a.checkin_date))
    .slice(0, SLEEP_WINDOW_DAYS);

  if (withSleep.length < SLEEP_WINDOW_DAYS) return null;

  const avg = withSleep.reduce((sum, c) => sum + c.sleep_hours!, 0) / withSleep.length;

  if (avg < SLEEP_HOURS_THRESHOLD) {
    return {
      trigger: 'sleep_deficit',
      change_summary: `Average sleep ${avg.toFixed(1)}h over last ${SLEEP_WINDOW_DAYS} check-ins — reduce next quality session intensity 20%`,
      affected_session_ids: [],
      change_details: {
        avg_sleep_hours: avg,
        reduce_intensity_factor: QUALITY_INTENSITY_REDUCTION,
        reduce_next_quality: true,
      },
    };
  }
  return null;
}

// ─── Rule 6: Checkpoint red ───────────────────────────────────────────────────

/**
 * Fires when the latest checkpoint verdict is 'red'.
 * Flags for review and offers AI plan regeneration — does NOT auto-call AI.
 * Per ADR-008: user must explicitly accept regen.
 */
export function checkCheckpointRed(checkpoints: CheckpointWindow[]): AdjustmentAction | null {
  if (checkpoints.length === 0) return null;

  const latest = [...checkpoints].sort((a, b) => b.created_at.localeCompare(a.created_at))[0]!;

  if (latest.verdict === 'red') {
    return {
      trigger: 'checkpoint_red',
      change_summary:
        'Latest checkpoint red — plan flagged for review; AI regeneration available on request',
      affected_session_ids: [],
      change_details: {
        checkpoint_id: latest.id,
        checkpoint_week: latest.target_week,
        offer_regen: true,
        auto_applied: false,
      },
    };
  }
  return null;
}

// ─── Aggregate evaluator ──────────────────────────────────────────────────────

/** Run all 6 rules against the provided context and return any that fired. */
export function evaluateAdjustments(ctx: AdjustmentContext): AdjustmentAction[] {
  const results: (AdjustmentAction | null)[] = [
    checkMissedSessions(ctx.sessions, ctx.today),
    checkRhrElevated(ctx.checkins),
    checkNigglePersistent(ctx.niggles, ctx.today),
    ctx.thresholdPaceSec != null
      ? checkEasyTooFast(ctx.runs, ctx.sessions, ctx.thresholdPaceSec)
      : null,
    checkSleepDeficit(ctx.checkins),
    checkCheckpointRed(ctx.checkpoints),
  ];

  return results.filter((a): a is AdjustmentAction => a !== null);
}
