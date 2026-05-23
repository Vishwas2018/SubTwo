import type { Database } from '@/types/database.types';

export type PlannedSession = Database['public']['Tables']['planned_sessions']['Row'];
export type Run = Database['public']['Tables']['runs']['Row'];

export type CellState = 'completed' | 'today' | 'missed' | 'future' | 'rest';

/**
 * Groups a flat list of sessions by week_number.
 * Returns a Map keyed by week_number, values sorted by day_of_week.
 */
export function groupSessionsByWeek(sessions: PlannedSession[]): Map<number, PlannedSession[]> {
  const map = new Map<number, PlannedSession[]>();
  for (const s of sessions) {
    const week = map.get(s.week_number) ?? [];
    week.push(s);
    map.set(s.week_number, week);
  }
  for (const [k, v] of map) {
    map.set(k, v.sort((a, b) => a.day_of_week - b.day_of_week));
  }
  return map;
}

/**
 * Determines display state of a session cell.
 * "today" and "missed" are anchored to todayDate (YYYY-MM-DD in Melbourne time).
 */
export function cellState(
  session: PlannedSession,
  linkedRun: Run | null | undefined,
  todayDate: string,
): CellState {
  if (session.session_type === 'rest') return 'rest';
  if (linkedRun && !linkedRun.deleted_at) return 'completed';
  if (session.scheduled_date === todayDate) return 'today';
  if (session.scheduled_date < todayDate) return 'missed';
  return 'future';
}

/** Returns Melbourne local date string YYYY-MM-DD. */
export function melbourneToday(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Australia/Melbourne' });
}

/** Human-readable label for common race distances. */
export function distanceLabel(km: number): string {
  if (km <= 5.1) return '5K';
  if (km <= 10.1) return '10K';
  if (km <= 21.5) return 'Half Marathon';
  if (km <= 42.5) return 'Marathon';
  return `${km}km`;
}

/** Short abbreviation for session type label in table cells. */
export const SESSION_ABBREV: Record<string, string> = {
  easy: 'E',
  long_run: 'L',
  threshold: 'T',
  interval: 'I',
  marathon_pace: 'MP',
  recovery: 'Rec',
  race: 'Race',
  time_trial: 'TT',
  rest: 'Rest',
};
