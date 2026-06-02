export type ExperienceLevel = 'beginner' | 'intermediate' | 'advanced';

export type GenerateErrorType =
  | 'timeout'
  | 'rate_limit'
  | 'quota'
  | 'validation'
  | 'auth'
  | 'service'
  | 'network';

export type GenerateError = {
  type: GenerateErrorType;
  title: string;
  message: string;
  retryAfter?: number; // seconds
};

export type GoalType = 'specific' | 'ai_suggest';
export type CanRun5K = 'yes' | 'sometimes' | 'no';
export type LongRunDay = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';

export type WizardFormData = {
  // Step 1 — Race basics
  race_distance_km: string;
  race_date: string;
  race_name: string;
  // Step 2 — Experience level
  experience_level: ExperienceLevel | '';
  // Step 3 — Current fitness (all levels)
  weekly_km_current: string;
  // Step 3 — Beginner only
  longest_recent_run_km: string;
  can_run_5k_without_stopping: CanRun5K | '';
  // Step 3 — Intermediate / Advanced
  recent_race_distance_km: string;
  recent_race_time: string; // "hh:mm:ss"
  recent_race_date: string; // YYYY-MM-DD
  // Step 3 — Advanced only
  peak_weekly_km: string;
  threshold_pace_time: string; // "mm:ss" per km
  years_running: string;
  // Step 4 — Goal
  goal_type: GoalType | '';
  goal_time: string; // "hh:mm:ss"
  // Step 5 — Constraints
  days_per_week: string;
  long_run_day: LongRunDay | '';
  injury_history: string;
  notes: string;
  // Step 6 — Equipment (all optional)
  shoes: string;
  fuel: string;
  weight_kg: string;
};

export const INITIAL_FORM_DATA: WizardFormData = {
  race_distance_km: '',
  race_date: '',
  race_name: '',
  experience_level: '',
  weekly_km_current: '',
  longest_recent_run_km: '',
  can_run_5k_without_stopping: '',
  recent_race_distance_km: '',
  recent_race_time: '',
  recent_race_date: '',
  peak_weekly_km: '',
  threshold_pace_time: '',
  years_running: '',
  goal_type: '',
  goal_time: '',
  // Smart defaults — eliminates silent-fail dropdowns when user skips Step 3
  days_per_week: '4',
  long_run_day: 'sat',
  injury_history: '',
  notes: '',
  shoes: '',
  fuel: '',
  weight_kg: '',
};

export const QUICK_DISTANCES = [
  { label: '5K', value: '5' },
  { label: '10K', value: '10' },
  { label: 'Half', value: '21.1' },
  { label: 'Marathon', value: '42.2' },
] as const;

export const LONG_RUN_DAYS: { label: string; value: LongRunDay }[] = [
  { label: 'Monday', value: 'mon' },
  { label: 'Tuesday', value: 'tue' },
  { label: 'Wednesday', value: 'wed' },
  { label: 'Thursday', value: 'thu' },
  { label: 'Friday', value: 'fri' },
  { label: 'Saturday', value: 'sat' },
  { label: 'Sunday', value: 'sun' },
];

/** Convert "hh:mm:ss" or "mm:ss" string to total seconds. Returns null on invalid input. */
export function timeToSeconds(value: string): number | null {
  if (!value.trim()) return null;
  const parts = value.trim().split(':').map(Number);
  if (parts.some(isNaN)) return null;
  if (parts.length === 2) {
    const [m, s] = parts as [number, number];
    if (s < 0 || s >= 60) return null;
    return m * 60 + s;
  }
  if (parts.length === 3) {
    const [h, m, s] = parts as [number, number, number];
    if (m < 0 || m >= 60 || s < 0 || s >= 60) return null;
    return h * 3600 + m * 60 + s;
  }
  return null;
}

/** Convert seconds to "h:mm:ss" string. */
export function secondsToTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/** Check whether a date string (YYYY-MM-DD) is in the future. */
export function isFutureDate(dateStr: string): boolean {
  if (!dateStr) return false;
  const d = new Date(dateStr + 'T00:00:00Z');
  return d > new Date();
}
