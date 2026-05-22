/**
 * Pure alert-rule functions for the dashboard.
 * Each function takes pre-fetched data slices and returns an alert or null.
 * All rules mirror PRD §3.6 alert logic.
 *
 * Pace convention: lower avg_pace_seconds = faster; min_seconds_per_km = slowest bound.
 * easy zone max_seconds_per_km is the FAST ceiling of the easy zone.
 */

export type Alert = { level: 'warn'; message: string };

/**
 * Rule 1 — Easy runs too fast.
 * Triggers when the last 3 easy runs all have avg_pace within 7 s/km of the
 * easy zone fast ceiling (max_seconds_per_km). Means the athlete is pushing
 * too hard on recovery days.
 *
 * @param recentEasyPaces  avg_pace_seconds for last N easy runs, newest first
 * @param easyCeilingSec   easy zone max_seconds_per_km (fast limit; lower = faster)
 */
export function easyPaceAlert(
  recentEasyPaces: number[],
  easyCeilingSec: number,
): Alert | null {
  if (recentEasyPaces.length < 3) return null;
  const last3 = recentEasyPaces.slice(0, 3);
  // Warn when every recent easy run is within 7 s/km of (or faster than) the ceiling
  if (last3.every((p) => p <= easyCeilingSec + 7)) {
    return {
      level: 'warn',
      message:
        'Your last 3 easy runs were at or near your easy zone ceiling. Keep easy days easy.',
    };
  }
  return null;
}

/**
 * Rule 2 — Low sleep.
 * Triggers when average sleep_hours over the provided check-in slice is < 7h.
 *
 * @param recentSleepHours  sleep_hours from last N check-ins (only non-null values)
 */
export function sleepAlert(recentSleepHours: number[]): Alert | null {
  if (recentSleepHours.length === 0) return null;
  const avg = recentSleepHours.reduce((s, h) => s + h, 0) / recentSleepHours.length;
  if (avg < 7) {
    return {
      level: 'warn',
      message: `Average sleep ${avg.toFixed(1)}h over last ${recentSleepHours.length} check-ins. Aim for 7–9h to support recovery.`,
    };
  }
  return null;
}

/**
 * Rule 3 — Long-running niggle.
 * Triggers when any active niggle has been active for ≥ 5 days.
 *
 * @param activeDaysPerNiggle  array of days-active for each unresolved niggle
 */
export function niggleAlert(activeDaysPerNiggle: number[]): Alert | null {
  if (activeDaysPerNiggle.some((d) => d >= 5)) {
    return {
      level: 'warn',
      message:
        'You have a niggle active for 5 or more days. Consider seeing a physio before it worsens.',
    };
  }
  return null;
}

/** Compute all alerts and return a deduplicated list. */
export function computeAlerts(params: {
  recentEasyPaces: number[];
  easyCeilingSec: number | null;
  recentSleepHours: number[];
  activeDaysPerNiggle: number[];
}): Alert[] {
  const { recentEasyPaces, easyCeilingSec, recentSleepHours, activeDaysPerNiggle } = params;
  const alerts: Alert[] = [];

  if (easyCeilingSec !== null) {
    const a = easyPaceAlert(recentEasyPaces, easyCeilingSec);
    if (a) alerts.push(a);
  }

  const s = sleepAlert(recentSleepHours);
  if (s) alerts.push(s);

  const n = niggleAlert(activeDaysPerNiggle);
  if (n) alerts.push(n);

  return alerts;
}

/** Days between two date strings (YYYY-MM-DD), inclusive of start. */
export function daysBetween(startDate: string, endDate: string): number {
  const start = new Date(startDate + 'T00:00:00Z');
  const end = new Date(endDate + 'T00:00:00Z');
  return Math.max(0, Math.round((end.getTime() - start.getTime()) / 86_400_000));
}
