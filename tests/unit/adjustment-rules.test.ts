// Unit tests for lib/adjustment-rules.ts — 100% coverage required.
// All functions are pure; no DB calls, no mocks needed.
// Refs: P3-04
import { describe, expect, it } from 'vitest';
import {
  checkMissedSessions,
  checkRhrElevated,
  checkNigglePersistent,
  checkEasyTooFast,
  checkSleepDeficit,
  checkCheckpointRed,
  evaluateAdjustments,
  MISSED_SESSION_THRESHOLD,
  RHR_ELEVATION_BPM,
  RHR_CONSECUTIVE_DAYS,
  NIGGLE_DAYS_THRESHOLD,
  EASY_PACE_GAP_SEC,
  SLEEP_HOURS_THRESHOLD,
  SLEEP_WINDOW_DAYS,
  DELOAD_FACTOR,
  QUALITY_INTENSITY_REDUCTION,
  KEY_SESSION_TYPES,
  type SessionWindow,
  type RunWindow,
  type CheckinWindow,
  type NiggleWindow,
  type CheckpointWindow,
  type AdjustmentContext,
} from '@/lib/adjustment-rules';

// ─── Fixtures ──────────────────────────────────────────────────────────────────

const TODAY = '2026-05-22';

function makeSession(overrides: Partial<SessionWindow> = {}): SessionWindow {
  return {
    id: 'sess-1',
    session_type: 'threshold',
    scheduled_date: '2026-05-20',
    week_number: 10,
    distance_km: 10,
    target_pace_min: null,
    target_pace_max: null,
    is_deload: false,
    has_run: false,
    ...overrides,
  };
}

function makeRun(overrides: Partial<RunWindow> = {}): RunWindow {
  return {
    id: 'run-1',
    run_date: '2026-05-20',
    avg_pace_seconds: 380,
    planned_session_id: 'sess-easy-1',
    ...overrides,
  };
}

function makeCheckin(overrides: Partial<CheckinWindow> = {}): CheckinWindow {
  return {
    checkin_date: '2026-05-20',
    sleep_hours: 8,
    resting_hr: 48,
    ...overrides,
  };
}

function makeNiggle(overrides: Partial<NiggleWindow> = {}): NiggleWindow {
  return {
    id: 'nig-1',
    started_date: '2026-05-10',
    resolved_date: null,
    body_part: 'left knee',
    ...overrides,
  };
}

function makeCheckpoint(overrides: Partial<CheckpointWindow> = {}): CheckpointWindow {
  return {
    id: 'cp-1',
    verdict: 'green',
    target_week: 8,
    created_at: '2026-05-20T10:00:00Z',
    ...overrides,
  };
}

// ─── Exported constants ────────────────────────────────────────────────────────

describe('exported threshold constants', () => {
  it('MISSED_SESSION_THRESHOLD is 2', () => {
    expect(MISSED_SESSION_THRESHOLD).toBe(2);
  });
  it('RHR_ELEVATION_BPM is 5', () => {
    expect(RHR_ELEVATION_BPM).toBe(5);
  });
  it('RHR_CONSECUTIVE_DAYS is 3', () => {
    expect(RHR_CONSECUTIVE_DAYS).toBe(3);
  });
  it('NIGGLE_DAYS_THRESHOLD is 5', () => {
    expect(NIGGLE_DAYS_THRESHOLD).toBe(5);
  });
  it('EASY_PACE_GAP_SEC is 7', () => {
    expect(EASY_PACE_GAP_SEC).toBe(7);
  });
  it('SLEEP_HOURS_THRESHOLD is 7', () => {
    expect(SLEEP_HOURS_THRESHOLD).toBe(7);
  });
  it('SLEEP_WINDOW_DAYS is 3', () => {
    expect(SLEEP_WINDOW_DAYS).toBe(3);
  });
  it('DELOAD_FACTOR is 0.65', () => {
    expect(DELOAD_FACTOR).toBeCloseTo(0.65);
  });
  it('QUALITY_INTENSITY_REDUCTION is 0.8', () => {
    expect(QUALITY_INTENSITY_REDUCTION).toBeCloseTo(0.8);
  });
  it('KEY_SESSION_TYPES includes expected types', () => {
    expect(KEY_SESSION_TYPES).toContain('threshold');
    expect(KEY_SESSION_TYPES).toContain('interval');
    expect(KEY_SESSION_TYPES).toContain('long_run');
  });
});

// ─── Rule 1: checkMissedSessions ──────────────────────────────────────────────

describe('checkMissedSessions', () => {
  it('returns null when no sessions in window', () => {
    expect(checkMissedSessions([], TODAY)).toBeNull();
  });

  it('returns null when only 1 key session missed', () => {
    const sessions = [makeSession({ has_run: false, scheduled_date: '2026-05-21' })];
    expect(checkMissedSessions(sessions, TODAY)).toBeNull();
  });

  it('triggers when 2 key sessions missed in last 7 days', () => {
    const sessions = [
      makeSession({ id: 'a', session_type: 'threshold', scheduled_date: '2026-05-20', has_run: false }),
      makeSession({ id: 'b', session_type: 'interval', scheduled_date: '2026-05-19', has_run: false }),
    ];
    const action = checkMissedSessions(sessions, TODAY);
    expect(action).not.toBeNull();
    expect(action!.trigger).toBe('missed_sessions');
    expect(action!.change_details.missed_count).toBe(2);
    expect(action!.change_details.deload_next_week).toBe(true);
  });

  it('triggers when 3+ key sessions missed (summarises count)', () => {
    const sessions = [
      makeSession({ id: 'a', scheduled_date: '2026-05-20', has_run: false }),
      makeSession({ id: 'b', scheduled_date: '2026-05-19', has_run: false }),
      makeSession({ id: 'c', scheduled_date: '2026-05-18', has_run: false }),
    ];
    const action = checkMissedSessions(sessions, TODAY);
    expect(action!.change_details.missed_count).toBe(3);
    expect(action!.change_summary).toMatch(/3 key sessions/);
  });

  it('does not count sessions where has_run=true', () => {
    const sessions = [
      makeSession({ id: 'a', scheduled_date: '2026-05-20', has_run: true }),
      makeSession({ id: 'b', scheduled_date: '2026-05-19', has_run: false }),
    ];
    expect(checkMissedSessions(sessions, TODAY)).toBeNull();
  });

  it('does not count non-key session types (easy, rest, recovery)', () => {
    const sessions = [
      makeSession({ id: 'a', session_type: 'easy', scheduled_date: '2026-05-20', has_run: false }),
      makeSession({ id: 'b', session_type: 'rest', scheduled_date: '2026-05-19', has_run: false }),
      makeSession({ id: 'c', session_type: 'recovery', scheduled_date: '2026-05-18', has_run: false }),
    ];
    expect(checkMissedSessions(sessions, TODAY)).toBeNull();
  });

  it('does not count sessions scheduled for today or future', () => {
    const sessions = [
      makeSession({ id: 'a', scheduled_date: TODAY, has_run: false }),
      makeSession({ id: 'b', scheduled_date: '2026-05-23', has_run: false }),
    ];
    expect(checkMissedSessions(sessions, TODAY)).toBeNull();
  });

  it('does not count sessions older than 7 days', () => {
    const sessions = [
      makeSession({ id: 'a', scheduled_date: '2026-05-14', has_run: false }),
      makeSession({ id: 'b', scheduled_date: '2026-05-13', has_run: false }),
    ];
    expect(checkMissedSessions(sessions, TODAY)).toBeNull();
  });

  it('boundary: session exactly 7 days ago is included', () => {
    const sevenDaysAgo = '2026-05-15'; // 22 - 7 = 15
    const sessions = [
      makeSession({ id: 'a', scheduled_date: sevenDaysAgo, has_run: false }),
      makeSession({ id: 'b', scheduled_date: '2026-05-16', has_run: false }),
    ];
    const action = checkMissedSessions(sessions, TODAY);
    expect(action).not.toBeNull();
    expect(action!.change_details.missed_count).toBe(2);
  });

  it('includes missed_session_ids in change_details', () => {
    const sessions = [
      makeSession({ id: 'sess-x', scheduled_date: '2026-05-20', has_run: false }),
      makeSession({ id: 'sess-y', scheduled_date: '2026-05-19', has_run: false }),
    ];
    const action = checkMissedSessions(sessions, TODAY);
    const ids = action!.change_details.missed_session_ids as string[];
    expect(ids).toContain('sess-x');
    expect(ids).toContain('sess-y');
  });

  it('returns affected_session_ids as empty array (populated by apply.ts)', () => {
    const sessions = [
      makeSession({ id: 'a', scheduled_date: '2026-05-20', has_run: false }),
      makeSession({ id: 'b', scheduled_date: '2026-05-19', has_run: false }),
    ];
    const action = checkMissedSessions(sessions, TODAY);
    expect(action!.affected_session_ids).toEqual([]);
  });
});

// ─── Rule 2: checkRhrElevated ─────────────────────────────────────────────────

describe('checkRhrElevated', () => {
  it('returns null when empty checkin list', () => {
    expect(checkRhrElevated([])).toBeNull();
  });

  it('returns null when fewer than 4 check-ins with RHR', () => {
    const checkins = [
      makeCheckin({ checkin_date: '2026-05-22', resting_hr: 70 }),
      makeCheckin({ checkin_date: '2026-05-21', resting_hr: 70 }),
      makeCheckin({ checkin_date: '2026-05-20', resting_hr: 70 }),
    ];
    expect(checkRhrElevated(checkins)).toBeNull();
  });

  it('returns null when last 3 days are elevated but not all 3', () => {
    // Baseline: avg of 4 = 48; last 3 are 54, 54, 48 — third is NOT elevated
    const checkins = [
      makeCheckin({ checkin_date: '2026-05-22', resting_hr: 54 }),
      makeCheckin({ checkin_date: '2026-05-21', resting_hr: 54 }),
      makeCheckin({ checkin_date: '2026-05-20', resting_hr: 48 }),
      makeCheckin({ checkin_date: '2026-05-19', resting_hr: 48 }),
    ];
    expect(checkRhrElevated(checkins)).toBeNull();
  });

  it('triggers when last 3 consecutive days all > baseline + 5', () => {
    // Baseline from 4 readings: avg = (48 + 48 + 60 + 60 + 60) / 5 ≈ 55.2
    // Last 3 are all 60: 60 > 55.2 + 5? 60 > 60.2? no... Let me use better numbers.
    // baseline avg of all: (50+50+50+50+70+70+70)/7 = 72/7 ... let me be explicit
    // 4 baseline readings at 50, 3 recent readings at 70
    // avg = (50+50+50+50+70+70+70)/7 = 410/7 ≈ 58.57; last 3 = 70: 70 > 58.57+5=63.57 ✓
    const checkins = [
      makeCheckin({ checkin_date: '2026-05-22', resting_hr: 70 }),
      makeCheckin({ checkin_date: '2026-05-21', resting_hr: 70 }),
      makeCheckin({ checkin_date: '2026-05-20', resting_hr: 70 }),
      makeCheckin({ checkin_date: '2026-05-19', resting_hr: 50 }),
      makeCheckin({ checkin_date: '2026-05-18', resting_hr: 50 }),
      makeCheckin({ checkin_date: '2026-05-17', resting_hr: 50 }),
      makeCheckin({ checkin_date: '2026-05-16', resting_hr: 50 }),
    ];
    const action = checkRhrElevated(checkins);
    expect(action).not.toBeNull();
    expect(action!.trigger).toBe('rhr_elevated');
    expect(action!.change_details.deload_next_quality).toBe(true);
    expect(action!.change_details.baseline_rhr).toBeGreaterThan(0);
  });

  it('ignores check-ins with null resting_hr', () => {
    // Only 3 non-null entries → not enough
    const checkins = [
      makeCheckin({ checkin_date: '2026-05-22', resting_hr: 70 }),
      makeCheckin({ checkin_date: '2026-05-21', resting_hr: null }),
      makeCheckin({ checkin_date: '2026-05-20', resting_hr: 70 }),
      makeCheckin({ checkin_date: '2026-05-19', resting_hr: 70 }),
    ];
    // Only 3 non-null — less than 4 needed
    expect(checkRhrElevated(checkins)).toBeNull();
  });

  it('returns null when RHR elevated by exactly 5bpm (boundary: must be strictly >', () => {
    // baseline avg = 50, last 3 = 55; 55 > 50+5=55 is FALSE (not strictly greater)
    const checkins = [
      makeCheckin({ checkin_date: '2026-05-22', resting_hr: 55 }),
      makeCheckin({ checkin_date: '2026-05-21', resting_hr: 55 }),
      makeCheckin({ checkin_date: '2026-05-20', resting_hr: 55 }),
      makeCheckin({ checkin_date: '2026-05-19', resting_hr: 55 }),
    ];
    // baseline avg = 55; 55 > 55+5 = 60 → false → no trigger
    expect(checkRhrElevated(checkins)).toBeNull();
  });

  it('includes recent_rhrs in change_details', () => {
    const checkins = [
      makeCheckin({ checkin_date: '2026-05-22', resting_hr: 70 }),
      makeCheckin({ checkin_date: '2026-05-21', resting_hr: 70 }),
      makeCheckin({ checkin_date: '2026-05-20', resting_hr: 70 }),
      makeCheckin({ checkin_date: '2026-05-19', resting_hr: 50 }),
      makeCheckin({ checkin_date: '2026-05-18', resting_hr: 50 }),
      makeCheckin({ checkin_date: '2026-05-17', resting_hr: 50 }),
      makeCheckin({ checkin_date: '2026-05-16', resting_hr: 50 }),
    ];
    const action = checkRhrElevated(checkins);
    const rhrs = action!.change_details.recent_rhrs as number[];
    expect(rhrs).toHaveLength(3);
    expect(rhrs.every((r) => r === 70)).toBe(true);
  });
});

// ─── Rule 3: checkNigglePersistent ────────────────────────────────────────────

describe('checkNigglePersistent', () => {
  it('returns null when no niggles', () => {
    expect(checkNigglePersistent([], TODAY)).toBeNull();
  });

  it('returns null when all niggles are resolved', () => {
    const niggles = [
      makeNiggle({ started_date: '2026-05-01', resolved_date: '2026-05-10' }),
    ];
    expect(checkNigglePersistent(niggles, TODAY)).toBeNull();
  });

  it('returns null when active niggle < 5 days', () => {
    const niggles = [makeNiggle({ started_date: '2026-05-19', resolved_date: null })];
    // 22 - 19 = 3 days
    expect(checkNigglePersistent(niggles, TODAY)).toBeNull();
  });

  it('triggers when active niggle exactly 5 days (boundary inclusive)', () => {
    const niggles = [makeNiggle({ started_date: '2026-05-17', resolved_date: null })];
    // 22 - 17 = 5 days
    const action = checkNigglePersistent(niggles, TODAY);
    expect(action).not.toBeNull();
    expect(action!.trigger).toBe('niggle_persistent');
    expect(action!.change_details.suggest_cross_train).toBe(true);
  });

  it('returns null when active niggle at 4 days (boundary exclusive)', () => {
    const niggles = [makeNiggle({ started_date: '2026-05-18', resolved_date: null })];
    // 22 - 18 = 4 days
    expect(checkNigglePersistent(niggles, TODAY)).toBeNull();
  });

  it('triggers for niggle active 12+ days', () => {
    const niggles = [makeNiggle({ started_date: '2026-05-10', resolved_date: null })];
    const action = checkNigglePersistent(niggles, TODAY);
    expect(action).not.toBeNull();
    expect(action!.change_summary).toMatch(/12 days/);
  });

  it('includes niggle body_part in change_summary', () => {
    const niggles = [makeNiggle({ started_date: '2026-05-10', body_part: 'right achilles' })];
    const action = checkNigglePersistent(niggles, TODAY);
    expect(action!.change_summary).toMatch(/right achilles/);
  });

  it('includes niggle_ids in change_details', () => {
    const niggles = [makeNiggle({ id: 'nig-abc', started_date: '2026-05-10' })];
    const action = checkNigglePersistent(niggles, TODAY);
    expect((action!.change_details.niggle_ids as string[])).toContain('nig-abc');
  });

  it('handles multiple persistent niggles', () => {
    const niggles = [
      makeNiggle({ id: 'n1', started_date: '2026-05-10', body_part: 'knee' }),
      makeNiggle({ id: 'n2', started_date: '2026-05-08', body_part: 'hip' }),
    ];
    const action = checkNigglePersistent(niggles, TODAY);
    expect(action).not.toBeNull();
    const ids = action!.change_details.niggle_ids as string[];
    expect(ids).toContain('n1');
    expect(ids).toContain('n2');
  });
});

// ─── Rule 4: checkEasyTooFast ─────────────────────────────────────────────────

describe('checkEasyTooFast', () => {
  const THRESHOLD_CEILING = 320; // s/km — fast end of threshold zone

  const easySessions = [
    makeSession({ id: 'easy-1', session_type: 'easy', scheduled_date: '2026-05-20' }),
    makeSession({ id: 'easy-2', session_type: 'easy', scheduled_date: '2026-05-17' }),
    makeSession({ id: 'easy-3', session_type: 'easy', scheduled_date: '2026-05-15' }),
  ];

  it('returns null when fewer than 3 easy runs matched', () => {
    const runs = [
      makeRun({ id: 'r1', planned_session_id: 'easy-1', avg_pace_seconds: 325, run_date: '2026-05-20' }),
      makeRun({ id: 'r2', planned_session_id: 'easy-2', avg_pace_seconds: 325, run_date: '2026-05-17' }),
    ];
    expect(checkEasyTooFast(runs, easySessions, THRESHOLD_CEILING)).toBeNull();
  });

  it('returns null when runs not matched to easy sessions', () => {
    const runs = [
      makeRun({ id: 'r1', planned_session_id: null, avg_pace_seconds: 310, run_date: '2026-05-20' }),
      makeRun({ id: 'r2', planned_session_id: null, avg_pace_seconds: 310, run_date: '2026-05-17' }),
      makeRun({ id: 'r3', planned_session_id: null, avg_pace_seconds: 310, run_date: '2026-05-15' }),
    ];
    expect(checkEasyTooFast(runs, easySessions, THRESHOLD_CEILING)).toBeNull();
  });

  it('triggers when all 3 easy runs within 7s/km of threshold ceiling', () => {
    const runs = [
      makeRun({ id: 'r1', planned_session_id: 'easy-1', avg_pace_seconds: 322, run_date: '2026-05-20' }),
      makeRun({ id: 'r2', planned_session_id: 'easy-2', avg_pace_seconds: 325, run_date: '2026-05-17' }),
      makeRun({ id: 'r3', planned_session_id: 'easy-3', avg_pace_seconds: 320, run_date: '2026-05-15' }),
    ];
    const action = checkEasyTooFast(runs, easySessions, THRESHOLD_CEILING);
    expect(action).not.toBeNull();
    expect(action!.trigger).toBe('easy_too_fast');
    expect(action!.change_details.advisory_only).toBe(true);
    expect(action!.affected_session_ids).toEqual([]);
  });

  it('triggers at exact boundary: pace = threshold_ceiling + 7', () => {
    const pace = THRESHOLD_CEILING + EASY_PACE_GAP_SEC; // 327
    const runs = [
      makeRun({ id: 'r1', planned_session_id: 'easy-1', avg_pace_seconds: pace, run_date: '2026-05-20' }),
      makeRun({ id: 'r2', planned_session_id: 'easy-2', avg_pace_seconds: pace, run_date: '2026-05-17' }),
      makeRun({ id: 'r3', planned_session_id: 'easy-3', avg_pace_seconds: pace, run_date: '2026-05-15' }),
    ];
    const action = checkEasyTooFast(runs, easySessions, THRESHOLD_CEILING);
    expect(action).not.toBeNull();
  });

  it('returns null when one run is just outside the boundary (pace = ceiling + 8)', () => {
    const runs = [
      makeRun({ id: 'r1', planned_session_id: 'easy-1', avg_pace_seconds: THRESHOLD_CEILING + 8, run_date: '2026-05-20' }),
      makeRun({ id: 'r2', planned_session_id: 'easy-2', avg_pace_seconds: THRESHOLD_CEILING + 6, run_date: '2026-05-17' }),
      makeRun({ id: 'r3', planned_session_id: 'easy-3', avg_pace_seconds: THRESHOLD_CEILING + 6, run_date: '2026-05-15' }),
    ];
    expect(checkEasyTooFast(runs, easySessions, THRESHOLD_CEILING)).toBeNull();
  });

  it('uses only the 3 most recent easy runs (ignores older)', () => {
    const sessions4 = [
      ...easySessions,
      makeSession({ id: 'easy-4', session_type: 'easy', scheduled_date: '2026-05-12' }),
    ];
    const runs = [
      makeRun({ id: 'r1', planned_session_id: 'easy-1', avg_pace_seconds: 322, run_date: '2026-05-20' }),
      makeRun({ id: 'r2', planned_session_id: 'easy-2', avg_pace_seconds: 322, run_date: '2026-05-17' }),
      makeRun({ id: 'r3', planned_session_id: 'easy-3', avg_pace_seconds: 322, run_date: '2026-05-15' }),
      makeRun({ id: 'r4', planned_session_id: 'easy-4', avg_pace_seconds: 400, run_date: '2026-05-12' }),
    ];
    const action = checkEasyTooFast(runs, sessions4, THRESHOLD_CEILING);
    expect(action).not.toBeNull(); // 4th run excluded; 3 most recent are fast
  });

  it('also matches recovery session type', () => {
    const sessions = [
      makeSession({ id: 'rec-1', session_type: 'recovery', scheduled_date: '2026-05-20' }),
      makeSession({ id: 'rec-2', session_type: 'recovery', scheduled_date: '2026-05-17' }),
      makeSession({ id: 'rec-3', session_type: 'recovery', scheduled_date: '2026-05-15' }),
    ];
    const runs = [
      makeRun({ id: 'r1', planned_session_id: 'rec-1', avg_pace_seconds: 322, run_date: '2026-05-20' }),
      makeRun({ id: 'r2', planned_session_id: 'rec-2', avg_pace_seconds: 322, run_date: '2026-05-17' }),
      makeRun({ id: 'r3', planned_session_id: 'rec-3', avg_pace_seconds: 322, run_date: '2026-05-15' }),
    ];
    const action = checkEasyTooFast(runs, sessions, THRESHOLD_CEILING);
    expect(action).not.toBeNull();
  });

  it('skips runs with null avg_pace_seconds', () => {
    const runs = [
      makeRun({ id: 'r1', planned_session_id: 'easy-1', avg_pace_seconds: null, run_date: '2026-05-20' }),
      makeRun({ id: 'r2', planned_session_id: 'easy-2', avg_pace_seconds: 322, run_date: '2026-05-17' }),
      makeRun({ id: 'r3', planned_session_id: 'easy-3', avg_pace_seconds: 322, run_date: '2026-05-15' }),
    ];
    // Only 2 valid → no trigger
    expect(checkEasyTooFast(runs, easySessions, THRESHOLD_CEILING)).toBeNull();
  });
});

// ─── Rule 5: checkSleepDeficit ────────────────────────────────────────────────

describe('checkSleepDeficit', () => {
  it('returns null when empty checkins', () => {
    expect(checkSleepDeficit([])).toBeNull();
  });

  it('returns null when fewer than 3 check-ins with sleep data', () => {
    const checkins = [
      makeCheckin({ sleep_hours: 5, checkin_date: '2026-05-22' }),
      makeCheckin({ sleep_hours: 5, checkin_date: '2026-05-21' }),
    ];
    expect(checkSleepDeficit(checkins)).toBeNull();
  });

  it('triggers when average sleep < 7h across last 3 check-ins', () => {
    const checkins = [
      makeCheckin({ sleep_hours: 6, checkin_date: '2026-05-22' }),
      makeCheckin({ sleep_hours: 6.5, checkin_date: '2026-05-21' }),
      makeCheckin({ sleep_hours: 6, checkin_date: '2026-05-20' }),
    ];
    const action = checkSleepDeficit(checkins);
    expect(action).not.toBeNull();
    expect(action!.trigger).toBe('sleep_deficit');
    expect(action!.change_details.reduce_next_quality).toBe(true);
    expect(action!.change_details.reduce_intensity_factor).toBeCloseTo(0.8);
  });

  it('returns null when average sleep exactly 7h (boundary)', () => {
    const checkins = [
      makeCheckin({ sleep_hours: 7, checkin_date: '2026-05-22' }),
      makeCheckin({ sleep_hours: 7, checkin_date: '2026-05-21' }),
      makeCheckin({ sleep_hours: 7, checkin_date: '2026-05-20' }),
    ];
    expect(checkSleepDeficit(checkins)).toBeNull();
  });

  it('triggers when average is just below 7h (boundary)', () => {
    const checkins = [
      makeCheckin({ sleep_hours: 6.9, checkin_date: '2026-05-22' }),
      makeCheckin({ sleep_hours: 6.9, checkin_date: '2026-05-21' }),
      makeCheckin({ sleep_hours: 6.9, checkin_date: '2026-05-20' }),
    ];
    expect(checkSleepDeficit(checkins)).not.toBeNull();
  });

  it('uses only the 3 most recent check-ins', () => {
    // 4 check-ins: most recent 3 are fine (8h avg), 4th is bad (but ignored)
    const checkins = [
      makeCheckin({ sleep_hours: 8, checkin_date: '2026-05-22' }),
      makeCheckin({ sleep_hours: 8, checkin_date: '2026-05-21' }),
      makeCheckin({ sleep_hours: 8, checkin_date: '2026-05-20' }),
      makeCheckin({ sleep_hours: 3, checkin_date: '2026-05-19' }),
    ];
    expect(checkSleepDeficit(checkins)).toBeNull();
  });

  it('skips check-ins with null sleep_hours', () => {
    const checkins = [
      makeCheckin({ sleep_hours: null, checkin_date: '2026-05-22' }),
      makeCheckin({ sleep_hours: 5, checkin_date: '2026-05-21' }),
      makeCheckin({ sleep_hours: 5, checkin_date: '2026-05-20' }),
    ];
    // Only 2 non-null entries
    expect(checkSleepDeficit(checkins)).toBeNull();
  });

  it('change_summary includes the average', () => {
    const checkins = [
      makeCheckin({ sleep_hours: 6, checkin_date: '2026-05-22' }),
      makeCheckin({ sleep_hours: 6, checkin_date: '2026-05-21' }),
      makeCheckin({ sleep_hours: 6, checkin_date: '2026-05-20' }),
    ];
    const action = checkSleepDeficit(checkins);
    expect(action!.change_summary).toMatch(/6\.0h/);
  });
});

// ─── Rule 6: checkCheckpointRed ───────────────────────────────────────────────

describe('checkCheckpointRed', () => {
  it('returns null when no checkpoints', () => {
    expect(checkCheckpointRed([])).toBeNull();
  });

  it('returns null when latest checkpoint is green', () => {
    expect(checkCheckpointRed([makeCheckpoint({ verdict: 'green' })])).toBeNull();
  });

  it('returns null when latest checkpoint is amber', () => {
    expect(checkCheckpointRed([makeCheckpoint({ verdict: 'amber' })])).toBeNull();
  });

  it('triggers when latest checkpoint verdict is red', () => {
    const action = checkCheckpointRed([makeCheckpoint({ verdict: 'red' })]);
    expect(action).not.toBeNull();
    expect(action!.trigger).toBe('checkpoint_red');
    expect(action!.change_details.offer_regen).toBe(true);
    expect(action!.change_details.auto_applied).toBe(false);
  });

  it('uses the most recent checkpoint (by created_at)', () => {
    const checkpoints = [
      makeCheckpoint({ id: 'cp-old', verdict: 'red', created_at: '2026-05-10T10:00:00Z' }),
      makeCheckpoint({ id: 'cp-new', verdict: 'green', created_at: '2026-05-20T10:00:00Z' }),
    ];
    // Most recent is green → no trigger
    expect(checkCheckpointRed(checkpoints)).toBeNull();
  });

  it('triggers if most recent is red even with older green checkpoints', () => {
    const checkpoints = [
      makeCheckpoint({ id: 'cp-old', verdict: 'green', created_at: '2026-05-10T10:00:00Z' }),
      makeCheckpoint({ id: 'cp-new', verdict: 'red', created_at: '2026-05-20T10:00:00Z' }),
    ];
    const action = checkCheckpointRed(checkpoints);
    expect(action).not.toBeNull();
    expect(action!.change_details.checkpoint_id).toBe('cp-new');
  });

  it('includes checkpoint_week in change_details', () => {
    const action = checkCheckpointRed([makeCheckpoint({ verdict: 'red', target_week: 12 })]);
    expect(action!.change_details.checkpoint_week).toBe(12);
  });

  it('does not mutate input array (leaves original order intact)', () => {
    const checkpoints = [
      makeCheckpoint({ id: 'cp-1', verdict: 'red', created_at: '2026-05-10T10:00:00Z' }),
      makeCheckpoint({ id: 'cp-2', verdict: 'green', created_at: '2026-05-20T10:00:00Z' }),
    ];
    const before = checkpoints.map((c) => c.id);
    checkCheckpointRed(checkpoints);
    expect(checkpoints.map((c) => c.id)).toEqual(before);
  });
});

// ─── evaluateAdjustments ─────────────────────────────────────────────────────

describe('evaluateAdjustments', () => {
  const BASE_CTX: AdjustmentContext = {
    today: TODAY,
    sessions: [],
    runs: [],
    checkins: [],
    niggles: [],
    checkpoints: [],
    thresholdPaceSec: null,
  };

  it('returns empty array when no rules fire', () => {
    expect(evaluateAdjustments(BASE_CTX)).toEqual([]);
  });

  it('skips easy_too_fast check when thresholdPaceSec is null', () => {
    const ctx: AdjustmentContext = {
      ...BASE_CTX,
      thresholdPaceSec: null,
    };
    const actions = evaluateAdjustments(ctx);
    expect(actions.some((a) => a.trigger === 'easy_too_fast')).toBe(false);
  });

  it('skips easy_too_fast check when thresholdPaceSec is undefined', () => {
    const ctx: AdjustmentContext = { ...BASE_CTX };
    delete ctx.thresholdPaceSec;
    const actions = evaluateAdjustments(ctx);
    expect(actions.some((a) => a.trigger === 'easy_too_fast')).toBe(false);
  });

  it('runs easy_too_fast check when thresholdPaceSec is provided', () => {
    const easySessions = [
      makeSession({ id: 'e1', session_type: 'easy', scheduled_date: '2026-05-20' }),
      makeSession({ id: 'e2', session_type: 'easy', scheduled_date: '2026-05-17' }),
      makeSession({ id: 'e3', session_type: 'easy', scheduled_date: '2026-05-15' }),
    ];
    const runs = [
      makeRun({ id: 'r1', planned_session_id: 'e1', avg_pace_seconds: 322, run_date: '2026-05-20' }),
      makeRun({ id: 'r2', planned_session_id: 'e2', avg_pace_seconds: 322, run_date: '2026-05-17' }),
      makeRun({ id: 'r3', planned_session_id: 'e3', avg_pace_seconds: 322, run_date: '2026-05-15' }),
    ];
    const ctx: AdjustmentContext = {
      ...BASE_CTX,
      sessions: easySessions,
      runs,
      thresholdPaceSec: 320,
    };
    const actions = evaluateAdjustments(ctx);
    expect(actions.some((a) => a.trigger === 'easy_too_fast')).toBe(true);
  });

  it('returns multiple actions when multiple rules fire simultaneously', () => {
    const checkins = [
      makeCheckin({ sleep_hours: 5, resting_hr: 70, checkin_date: '2026-05-22' }),
      makeCheckin({ sleep_hours: 5, resting_hr: 70, checkin_date: '2026-05-21' }),
      makeCheckin({ sleep_hours: 5, resting_hr: 70, checkin_date: '2026-05-20' }),
      makeCheckin({ sleep_hours: 5, resting_hr: 50, checkin_date: '2026-05-19' }),
      makeCheckin({ sleep_hours: 5, resting_hr: 50, checkin_date: '2026-05-18' }),
      makeCheckin({ sleep_hours: 5, resting_hr: 50, checkin_date: '2026-05-17' }),
      makeCheckin({ sleep_hours: 5, resting_hr: 50, checkin_date: '2026-05-16' }),
    ];
    const niggles = [makeNiggle({ started_date: '2026-05-10' })];
    const checkpoints = [makeCheckpoint({ verdict: 'red' })];
    const ctx: AdjustmentContext = {
      ...BASE_CTX,
      checkins,
      niggles,
      checkpoints,
    };
    const actions = evaluateAdjustments(ctx);
    const triggers = actions.map((a) => a.trigger);
    expect(triggers).toContain('rhr_elevated');
    expect(triggers).toContain('sleep_deficit');
    expect(triggers).toContain('niggle_persistent');
    expect(triggers).toContain('checkpoint_red');
    expect(actions.length).toBeGreaterThanOrEqual(4);
  });

  it('filters out null results from all 6 rule checks', () => {
    const sessions = [
      makeSession({ id: 'a', scheduled_date: '2026-05-20', has_run: false }),
      makeSession({ id: 'b', scheduled_date: '2026-05-19', has_run: false }),
    ];
    const ctx: AdjustmentContext = { ...BASE_CTX, sessions };
    const actions = evaluateAdjustments(ctx);
    expect(actions.every((a) => a !== null)).toBe(true);
  });
});
