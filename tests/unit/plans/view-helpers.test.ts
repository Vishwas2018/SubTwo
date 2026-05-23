// Unit tests for lib/plans/view-helpers.ts
// Refs: P2-07, P2-08
import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  groupSessionsByWeek,
  cellState,
  melbourneToday,
  SESSION_ABBREV,
  distanceLabel,
} from '@/lib/plans/view-helpers';
import type { PlannedSession, Run } from '@/lib/plans/view-helpers';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeSession(overrides: Partial<PlannedSession> = {}): PlannedSession {
  return {
    id: 'sess-1',
    plan_id: 'plan-1',
    plan_version_id: 'ver-1',
    week_number: 1,
    day_of_week: 1,
    phase: 'base',
    session_type: 'easy',
    distance_km: 8,
    scheduled_date: '2026-06-01',
    target_pace_min: null,
    target_pace_max: null,
    focus: null,
    structure: null,
    notes: null,
    is_checkpoint: false,
    is_deload: false,
    checkpoint_type: null,
    created_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

function makeRun(overrides: Partial<Run> = {}): Run {
  return {
    id: 'run-1',
    user_id: 'user-1',
    planned_session_id: 'sess-1',
    run_date: '2026-06-01',
    distance_km: 8,
    duration_seconds: 2880,
    source: 'manual',
    avg_pace_seconds: 360,
    avg_hr: null,
    max_hr: null,
    avg_cadence: null,
    elevation_gain_m: null,
    rpe: null,
    felt_easy: null,
    stitch_occurred: false,
    stitch_severity: null,
    shoes: null,
    notes: null,
    external_id: null,
    raw_data: null,
    weather: null,
    start_time: null,
    deleted_at: null,
    created_at: '2026-06-01T10:00:00Z',
    ...overrides,
  };
}

// ─── groupSessionsByWeek ─────────────────────────────────────────────────────

describe('groupSessionsByWeek', () => {
  it('groups sessions by week_number', () => {
    const sessions = [
      makeSession({ id: 'a', week_number: 1, day_of_week: 1 }),
      makeSession({ id: 'b', week_number: 2, day_of_week: 3 }),
      makeSession({ id: 'c', week_number: 1, day_of_week: 3 }),
    ];
    const map = groupSessionsByWeek(sessions);
    expect(map.size).toBe(2);
    expect(map.get(1)?.map((s) => s.id)).toEqual(['a', 'c']);
    expect(map.get(2)?.map((s) => s.id)).toEqual(['b']);
  });

  it('sorts sessions within a week by day_of_week', () => {
    const sessions = [
      makeSession({ id: 'c', week_number: 1, day_of_week: 7 }),
      makeSession({ id: 'a', week_number: 1, day_of_week: 1 }),
      makeSession({ id: 'b', week_number: 1, day_of_week: 4 }),
    ];
    const map = groupSessionsByWeek(sessions);
    expect(map.get(1)?.map((s) => s.day_of_week)).toEqual([1, 4, 7]);
  });

  it('returns empty map for empty array', () => {
    expect(groupSessionsByWeek([]).size).toBe(0);
  });
});

// ─── cellState ───────────────────────────────────────────────────────────────

describe('cellState', () => {
  const today = '2026-06-15';

  it('returns rest for rest session', () => {
    const s = makeSession({ session_type: 'rest', scheduled_date: today });
    expect(cellState(s, null, today)).toBe('rest');
  });

  it('returns rest for rest even with a linked run', () => {
    const s = makeSession({ session_type: 'rest', scheduled_date: today });
    const run = makeRun();
    expect(cellState(s, run, today)).toBe('rest');
  });

  it('returns completed when linked run exists (not deleted)', () => {
    const s = makeSession({ scheduled_date: '2026-06-10' });
    const run = makeRun({ deleted_at: null });
    expect(cellState(s, run, today)).toBe('completed');
  });

  it('does not count deleted run as completed', () => {
    const s = makeSession({ scheduled_date: '2026-06-10' });
    const run = makeRun({ deleted_at: '2026-06-11T00:00:00Z' });
    expect(cellState(s, run, today)).toBe('missed');
  });

  it('returns today when scheduled_date equals today (no run)', () => {
    const s = makeSession({ scheduled_date: today });
    expect(cellState(s, null, today)).toBe('today');
  });

  it('returns missed when scheduled_date is before today (no run)', () => {
    const s = makeSession({ scheduled_date: '2026-06-14' });
    expect(cellState(s, null, today)).toBe('missed');
  });

  it('returns future when scheduled_date is after today', () => {
    const s = makeSession({ scheduled_date: '2026-06-16' });
    expect(cellState(s, null, today)).toBe('future');
  });

  it('boundary: one day before today is missed', () => {
    const s = makeSession({ scheduled_date: '2026-06-14' });
    expect(cellState(s, null, today)).toBe('missed');
  });

  it('boundary: one day after today is future', () => {
    const s = makeSession({ scheduled_date: '2026-06-16' });
    expect(cellState(s, null, today)).toBe('future');
  });

  it('handles undefined linked run (query may return undefined)', () => {
    const s = makeSession({ scheduled_date: '2026-06-14' });
    expect(cellState(s, undefined, today)).toBe('missed');
  });
});

// ─── melbourneToday ──────────────────────────────────────────────────────────

describe('melbourneToday', () => {
  afterEach(() => vi.useRealTimers());

  it('returns YYYY-MM-DD format', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-15T10:00:00Z'));
    const result = melbourneToday();
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('returns Melbourne date (UTC+10/+11 depending on DST)', () => {
    vi.useFakeTimers();
    // 2026-06-15 14:00 UTC = 2026-06-16 00:00 AEST (UTC+10)
    vi.setSystemTime(new Date('2026-06-15T14:00:00Z'));
    const result = melbourneToday();
    expect(result).toBe('2026-06-16');
  });
});

// ─── distanceLabel ────────────────────────────────────────────────────────────

describe('distanceLabel', () => {
  it('returns 5K for 5km', () => expect(distanceLabel(5)).toBe('5K'));
  it('returns 5K for boundary 5.1km', () => expect(distanceLabel(5.1)).toBe('5K'));
  it('returns 10K for 10km', () => expect(distanceLabel(10)).toBe('10K'));
  it('returns 10K for boundary 10.1km', () => expect(distanceLabel(10.1)).toBe('10K'));
  it('returns Half Marathon for 21.1km', () => expect(distanceLabel(21.1)).toBe('Half Marathon'));
  it('returns Half Marathon for boundary 21.5km', () => expect(distanceLabel(21.5)).toBe('Half Marathon'));
  it('returns Marathon for 42.195km', () => expect(distanceLabel(42.195)).toBe('Marathon'));
  it('returns Marathon for boundary 42.5km', () => expect(distanceLabel(42.5)).toBe('Marathon'));
  it('returns numeric for ultra distances', () => expect(distanceLabel(50)).toBe('50km'));
  it('returns numeric for non-standard distances above marathon', () => expect(distanceLabel(80)).toBe('80km'));
});

// ─── SESSION_ABBREV ───────────────────────────────────────────────────────────

describe('SESSION_ABBREV', () => {
  it('has entries for all expected session types', () => {
    const types = ['easy', 'long_run', 'threshold', 'interval', 'marathon_pace', 'recovery', 'race', 'time_trial', 'rest'];
    for (const t of types) {
      expect(SESSION_ABBREV[t]).toBeDefined();
    }
  });
});
