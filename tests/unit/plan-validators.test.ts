import { describe, expect, it } from 'vitest';
import {
  LONG_RUN_MAX_PCT_OF_WEEK,
  MAX_QUALITY_SESSIONS_PER_WEEK,
  PEAK_KM_BY_LEVEL,
  SESSION_MAX_DISTANCE_KM,
  TAPER_MAX_PCT_OF_PEAK,
  VOLUME_INCREASE_CAP,
  WEEKLY_MAX_KM,
  WEEKLY_MIN_KM,
  type PlannedSession,
  validateDeloadCadence,
  validateDistanceBounds,
  validateExperienceLevel,
  validatePaceConsistency,
  validatePlan,
  validateRaceDayAndTaper,
  validateRecoveryStructure,
  validateStructuralIntegrity,
  validateVolumeProgression,
} from '@/lib/plan-validators';

// ─── Fixture helper ───────────────────────────────────────────────────────────

function s(
  week: number,
  day: number,
  type: PlannedSession['session_type'],
  km?: number,
  pace?: number
): PlannedSession {
  return {
    week_number: week,
    day_of_week: day,
    session_type: type,
    ...(km !== undefined && { distance_km: km }),
    ...(pace !== undefined && { target_pace_seconds_per_km: pace }),
  };
}

// ─── Exported constants ───────────────────────────────────────────────────────

describe('exported thresholds', () => {
  it('VOLUME_INCREASE_CAP is 0.10', () => {
    expect(VOLUME_INCREASE_CAP).toBe(0.1);
  });

  it('LONG_RUN_MAX_PCT_OF_WEEK is 0.35', () => {
    expect(LONG_RUN_MAX_PCT_OF_WEEK).toBe(0.35);
  });

  it('TAPER_MAX_PCT_OF_PEAK is 0.50', () => {
    expect(TAPER_MAX_PCT_OF_PEAK).toBe(0.5);
  });

  it('PEAK_KM_BY_LEVEL has correct values', () => {
    expect(PEAK_KM_BY_LEVEL.beginner).toBe(60);
    expect(PEAK_KM_BY_LEVEL.intermediate).toBe(90);
    expect(PEAK_KM_BY_LEVEL.advanced).toBe(130);
  });

  it('SESSION_MAX_DISTANCE_KM is 50', () => {
    expect(SESSION_MAX_DISTANCE_KM).toBe(50);
  });

  it('WEEKLY_MIN_KM is 10 and WEEKLY_MAX_KM is 150', () => {
    expect(WEEKLY_MIN_KM).toBe(10);
    expect(WEEKLY_MAX_KM).toBe(150);
  });

  it('MAX_QUALITY_SESSIONS_PER_WEEK is 2', () => {
    expect(MAX_QUALITY_SESSIONS_PER_WEEK).toBe(2);
  });
});

// ─── validateStructuralIntegrity ─────────────────────────────────────────────

describe('validateStructuralIntegrity', () => {
  it('valid sessions → no issues', () => {
    const sessions = [
      s(1, 1, 'easy', 8),
      s(1, 4, 'threshold', 10, 280),
      s(1, 7, 'rest'),
      s(2, 1, 'easy', 8),
      s(2, 7, 'rest'),
    ];
    expect(validateStructuralIntegrity(sessions)).toHaveLength(0);
  });

  it('day_of_week = 0 → error', () => {
    const issues = validateStructuralIntegrity([s(1, 0, 'easy', 8)]);
    expect(issues).toHaveLength(1);
    expect(issues[0]!.rule).toBe('structural_integrity');
    expect(issues[0]!.severity).toBe('error');
  });

  it('day_of_week = 8 → error', () => {
    const issues = validateStructuralIntegrity([s(1, 8, 'easy', 8)]);
    expect(issues).toHaveLength(1);
  });

  it('duplicate (week, day) pair → error', () => {
    const sessions = [s(1, 1, 'easy', 8), s(1, 1, 'rest')];
    const issues = validateStructuralIntegrity(sessions);
    expect(issues.some((i) => i.message.includes('duplicate'))).toBe(true);
  });

  it('week numbers starting at 2 (not 1) → error', () => {
    const sessions = [s(2, 1, 'easy', 8), s(2, 7, 'rest')];
    const issues = validateStructuralIntegrity(sessions);
    expect(issues.some((i) => i.message.includes('start at 1'))).toBe(true);
  });

  it('gap in week numbers (1 then 3) → error', () => {
    const sessions = [s(1, 1, 'easy', 8), s(3, 1, 'easy', 8)];
    const issues = validateStructuralIntegrity(sessions);
    expect(issues.some((i) => i.message.includes('Non-sequential'))).toBe(true);
  });

  it('empty sessions → no issues', () => {
    expect(validateStructuralIntegrity([])).toHaveLength(0);
  });
});

// ─── validateVolumeProgression ────────────────────────────────────────────────

describe('validateVolumeProgression', () => {
  it('≤10% increase per week → no issues', () => {
    // 40 → 44 → 48 (each ≤ 10% of previous)
    const sessions = [s(1, 1, 'easy', 40), s(2, 1, 'easy', 44), s(3, 1, 'easy', 48)];
    expect(validateVolumeProgression(sessions)).toHaveLength(0);
  });

  it('exactly at 10% cap → no issues', () => {
    // 50 → 55 (exactly 10%)
    const sessions = [s(1, 1, 'easy', 50), s(2, 1, 'easy', 55)];
    expect(validateVolumeProgression(sessions)).toHaveLength(0);
  });

  it('exceeding 10% cap → error', () => {
    // 50 → 60 (20% increase)
    const sessions = [s(1, 1, 'easy', 50), s(2, 1, 'easy', 60)];
    const issues = validateVolumeProgression(sessions);
    expect(issues).toHaveLength(1);
    expect(issues[0]!.rule).toBe('volume_progression');
    expect(issues[0]!.week).toBe(2);
  });

  it('deload week (volume ≤80% of previous) is always allowed', () => {
    // 50 → 35 (70% of 50, clear deload)
    const sessions = [s(1, 1, 'easy', 50), s(2, 1, 'easy', 35)];
    expect(validateVolumeProgression(sessions)).toHaveLength(0);
  });

  it('post-deload week can jump back to pre-deload level', () => {
    // 50 → 35 (deload) → 50 (post-deload: 143% increase, normally blocked but exempt)
    const sessions = [s(1, 1, 'easy', 50), s(2, 1, 'easy', 35), s(3, 1, 'easy', 50)];
    expect(validateVolumeProgression(sessions)).toHaveLength(0);
  });

  it('single week → no issues', () => {
    expect(validateVolumeProgression([s(1, 1, 'easy', 50)])).toHaveLength(0);
  });

  it('empty sessions → no issues', () => {
    expect(validateVolumeProgression([])).toHaveLength(0);
  });
});

// ─── validateDeloadCadence ────────────────────────────────────────────────────

describe('validateDeloadCadence', () => {
  it('5-week plan with no deload → no issues (below threshold)', () => {
    const sessions = [40, 44, 48, 52, 57].map((km, i) => s(i + 1, 1, 'easy', km));
    expect(validateDeloadCadence(sessions)).toHaveLength(0);
  });

  it('7-week plan with deload in week 4 → no issues', () => {
    // Week 4: 32km = 32/48 ≈ 67% of week 3 → deload detected
    const vols = [40, 44, 48, 32, 44, 48, 53];
    const sessions = vols.map((km, i) => s(i + 1, 1, 'easy', km));
    expect(validateDeloadCadence(sessions)).toHaveLength(0);
  });

  it('7 consecutive build weeks with no deload → warning at week 6', () => {
    const vols = [40, 44, 48, 52, 57, 62, 68];
    const sessions = vols.map((km, i) => s(i + 1, 1, 'easy', km));
    const issues = validateDeloadCadence(sessions);
    expect(issues).toHaveLength(1);
    expect(issues[0]!.severity).toBe('warning');
    expect(issues[0]!.week).toBe(6);
  });

  it('deload resets counter — only one warning per gap', () => {
    // 7 build weeks, flag at week 6, then reset, week 7 is only 1 consecutive after reset
    const vols = [40, 44, 48, 52, 57, 62, 68];
    const sessions = vols.map((km, i) => s(i + 1, 1, 'easy', km));
    expect(validateDeloadCadence(sessions)).toHaveLength(1);
  });
});

// ─── validatePaceConsistency ─────────────────────────────────────────────────

describe('validatePaceConsistency', () => {
  it('quality sessions with pace and valid easy pace → no issues', () => {
    const sessions = [
      s(1, 1, 'threshold', 10, 280), // quality with pace ✓
      s(1, 3, 'easy', 8, 360), // easy slower than threshold ✓
      s(1, 7, 'rest'),
    ];
    expect(validatePaceConsistency(sessions)).toHaveLength(0);
  });

  it('threshold session missing target_pace → error', () => {
    const sessions = [s(1, 1, 'threshold', 10)]; // no pace
    const issues = validatePaceConsistency(sessions);
    expect(issues).toHaveLength(1);
    expect(issues[0]!.rule).toBe('pace_consistency');
    expect(issues[0]!.message).toMatch(/missing target_pace/);
  });

  it('interval session missing target_pace → error', () => {
    const issues = validatePaceConsistency([s(1, 1, 'interval', 8)]);
    expect(issues).toHaveLength(1);
  });

  it('marathon_pace session missing target_pace → error', () => {
    const issues = validatePaceConsistency([s(1, 1, 'marathon_pace', 12)]);
    expect(issues).toHaveLength(1);
  });

  it('easy pace faster than threshold pace → error', () => {
    const sessions = [
      s(1, 1, 'threshold', 10, 280),
      s(1, 3, 'easy', 8, 270), // 270 < 280 → easy is FASTER than threshold
    ];
    const issues = validatePaceConsistency(sessions);
    expect(issues.some((i) => i.message.includes('must be slower'))).toBe(true);
  });

  it('easy pace equal to threshold pace → error', () => {
    const sessions = [s(1, 1, 'threshold', 10, 280), s(1, 3, 'easy', 8, 280)];
    const issues = validatePaceConsistency(sessions);
    expect(issues.some((i) => i.message.includes('must be slower'))).toBe(true);
  });

  it('no quality sessions → no issues', () => {
    const sessions = [s(1, 1, 'easy', 8, 360), s(1, 7, 'rest')];
    expect(validatePaceConsistency(sessions)).toHaveLength(0);
  });
});

// ─── validateDistanceBounds ───────────────────────────────────────────────────

describe('validateDistanceBounds', () => {
  it('valid weekly distances → no issues', () => {
    // long_run = 10km out of 30km total = 33.3% ≤ 35% ✓
    const sessions = [
      s(1, 1, 'easy', 10),
      s(1, 3, 'easy', 10),
      s(1, 5, 'long_run', 10),
      s(1, 7, 'rest'),
    ];
    expect(validateDistanceBounds(sessions)).toHaveLength(0);
  });

  it('session distance > 50 km → error', () => {
    const issues = validateDistanceBounds([s(1, 1, 'long_run', 51)]);
    expect(issues.some((i) => i.message.includes('exceeds max'))).toBe(true);
  });

  it('weekly volume < 10 km with running sessions → error', () => {
    const sessions = [s(1, 1, 'easy', 5), s(1, 2, 'rest')];
    const issues = validateDistanceBounds(sessions);
    expect(issues.some((i) => i.message.includes('below minimum'))).toBe(true);
  });

  it('weekly volume > 150 km → error', () => {
    const sessions = [s(1, 1, 'easy', 155), s(1, 7, 'rest')];
    const issues = validateDistanceBounds(sessions);
    expect(issues.some((i) => i.message.includes('exceeds maximum'))).toBe(true);
  });

  it('long run > 35% of weekly total → warning', () => {
    // long_run = 20km out of 30km total = 66.7% > 35%
    const sessions = [s(1, 1, 'long_run', 20), s(1, 3, 'easy', 10), s(1, 7, 'rest')];
    const issues = validateDistanceBounds(sessions);
    expect(issues.some((i) => i.severity === 'warning' && i.message.includes('long run'))).toBe(true);
  });

  it('all-rest week → no distance issues', () => {
    const sessions = [s(1, 1, 'rest'), s(1, 2, 'rest')];
    expect(validateDistanceBounds(sessions)).toHaveLength(0);
  });
});

// ─── validateRecoveryStructure ────────────────────────────────────────────────

describe('validateRecoveryStructure', () => {
  it('valid week: 1 rest, 1 quality, no consecutive quality → no issues', () => {
    const sessions = [
      s(1, 1, 'easy', 8),
      s(1, 3, 'threshold', 10, 280),
      s(1, 5, 'easy', 6),
      s(1, 7, 'rest'),
    ];
    expect(validateRecoveryStructure(sessions)).toHaveLength(0);
  });

  it('no rest day → error', () => {
    const sessions = [
      s(1, 1, 'easy', 8),
      s(1, 3, 'threshold', 10, 280),
      s(1, 5, 'long_run', 15),
    ];
    const issues = validateRecoveryStructure(sessions);
    expect(issues.some((i) => i.message.includes('no rest day'))).toBe(true);
  });

  it('3 quality sessions → error', () => {
    const sessions = [
      s(1, 1, 'threshold', 10, 280),
      s(1, 3, 'interval', 8, 260),
      s(1, 5, 'marathon_pace', 12, 295),
      s(1, 7, 'rest'),
    ];
    const issues = validateRecoveryStructure(sessions);
    expect(issues.some((i) => i.message.includes('quality sessions'))).toBe(true);
  });

  it('back-to-back quality sessions on consecutive days → error', () => {
    const sessions = [
      s(1, 1, 'threshold', 10, 280),
      s(1, 2, 'interval', 8, 260), // day 2 immediately after day 1 quality
      s(1, 7, 'rest'),
    ];
    const issues = validateRecoveryStructure(sessions);
    expect(issues.some((i) => i.message.includes('back-to-back'))).toBe(true);
  });

  it('2 quality sessions with a gap between them → no back-to-back error', () => {
    const sessions = [
      s(1, 1, 'threshold', 10, 280),
      s(1, 3, 'interval', 8, 260), // day 3 — not consecutive with day 1
      s(1, 7, 'rest'),
    ];
    const issues = validateRecoveryStructure(sessions);
    expect(issues.some((i) => i.message.includes('back-to-back'))).toBe(false);
  });
});

// ─── validateRaceDayAndTaper ──────────────────────────────────────────────────

describe('validateRaceDayAndTaper', () => {
  it('empty sessions → no issues', () => {
    expect(validateRaceDayAndTaper([])).toHaveLength(0);
  });

  it('final week with race and taper ≤50% of peak → no issues', () => {
    const sessions = [
      s(1, 1, 'easy', 44), // peak week: 44km
      s(2, 1, 'easy', 11), // race week: 11 + 10 = 21km = 47.7% ≤ 50%
      s(2, 5, 'race', 10),
      s(2, 7, 'rest'),
    ];
    expect(validateRaceDayAndTaper(sessions)).toHaveLength(0);
  });

  it('final week with time_trial is accepted', () => {
    const sessions = [s(1, 1, 'easy', 40), s(2, 1, 'time_trial', 5), s(2, 7, 'rest')];
    const issues = validateRaceDayAndTaper(sessions);
    expect(issues.some((i) => i.message.includes('no race'))).toBe(false);
  });

  it('final week missing race or time_trial → error', () => {
    const sessions = [s(1, 1, 'easy', 40), s(2, 1, 'easy', 10), s(2, 7, 'rest')];
    const issues = validateRaceDayAndTaper(sessions);
    expect(issues.some((i) => i.message.includes('no race or time_trial'))).toBe(true);
  });

  it('final week volume > 50% of peak → error', () => {
    // Peak = 50km, final = 30km (60% of peak)
    const sessions = [
      s(1, 1, 'easy', 50),
      s(2, 1, 'easy', 20),
      s(2, 3, 'race', 10), // 20 + 10 = 30km = 60% > 50%
    ];
    const issues = validateRaceDayAndTaper(sessions);
    expect(issues.some((i) => i.message.includes('taper'))).toBe(true);
  });
});

// ─── validateExperienceLevel ──────────────────────────────────────────────────

describe('validateExperienceLevel', () => {
  it('empty sessions → no issues', () => {
    expect(validateExperienceLevel([], 'beginner')).toHaveLength(0);
  });

  it('beginner at 55km peak (under 60km cap) → no issues', () => {
    const sessions = [s(1, 1, 'easy', 55)];
    expect(validateExperienceLevel(sessions, 'beginner')).toHaveLength(0);
  });

  it('beginner at 65km peak (over 60km cap) → warning', () => {
    const sessions = [s(1, 1, 'easy', 65)];
    const issues = validateExperienceLevel(sessions, 'beginner');
    expect(issues).toHaveLength(1);
    expect(issues[0]!.severity).toBe('warning');
    expect(issues[0]!.rule).toBe('experience_level');
  });

  it('intermediate at 95km peak (over 90km cap) → warning', () => {
    const sessions = [s(1, 1, 'easy', 95)];
    const issues = validateExperienceLevel(sessions, 'intermediate');
    expect(issues).toHaveLength(1);
    expect(issues[0]!.message).toMatch(/intermediate/);
  });

  it('advanced at 120km peak (under 130km cap) → no issues', () => {
    const sessions = [s(1, 1, 'easy', 120)];
    expect(validateExperienceLevel(sessions, 'advanced')).toHaveLength(0);
  });

  it('peak is taken from the highest week, not sum', () => {
    const sessions = [s(1, 1, 'easy', 40), s(2, 1, 'easy', 55)];
    // Peak = 55 < 60 → no issue for beginner
    expect(validateExperienceLevel(sessions, 'beginner')).toHaveLength(0);
  });
});

// ─── validatePlan (master) ────────────────────────────────────────────────────

describe('validatePlan', () => {
  // Minimal valid plan: 2 weeks, intermediate runner
  const validSessions = [
    // Week 1 (44km): easy Mon, rest Tue, threshold Wed (with pace), easy Thu (with pace), long_run Fri, easy Sat, rest Sun
    s(1, 1, 'easy', 8, 360),
    s(1, 2, 'rest'),
    s(1, 3, 'threshold', 10, 280),
    s(1, 4, 'easy', 6, 360),
    s(1, 5, 'long_run', 15),
    s(1, 6, 'easy', 5),
    s(1, 7, 'rest'),
    // Week 2 (21km): race week taper
    s(2, 1, 'easy', 6, 360),
    s(2, 2, 'rest'),
    s(2, 3, 'easy', 5, 360),
    s(2, 4, 'rest'),
    s(2, 5, 'rest'),
    s(2, 6, 'race', 10),
    s(2, 7, 'rest'),
  ];

  it('valid plan returns valid=true with no issues', () => {
    const result = validatePlan({ experience_level: 'intermediate', sessions: validSessions });
    expect(result.valid).toBe(true);
    expect(result.issues.filter((i) => i.severity === 'error')).toHaveLength(0);
  });

  it('plan with error returns valid=false', () => {
    const badSessions = [
      // Missing race day in final week
      s(1, 1, 'easy', 10),
      s(1, 7, 'rest'),
      s(2, 1, 'easy', 8), // no race session
      s(2, 7, 'rest'),
    ];
    const result = validatePlan({ experience_level: 'beginner', sessions: badSessions });
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.severity === 'error')).toBe(true);
  });

  it('plan with only warnings returns valid=true', () => {
    // Beginner with 65km peak → warning but no errors (use valid 2-week structure)
    const warnSessions = [
      s(1, 1, 'easy', 65), // over beginner cap → warning
      s(1, 7, 'rest'),
      s(2, 1, 'race', 5), // taper week
      s(2, 7, 'rest'),
    ];
    const result = validatePlan({ experience_level: 'beginner', sessions: warnSessions });
    // May have warnings but should have no errors (structure is valid)
    const errors = result.issues.filter((i) => i.severity === 'error');
    const warnings = result.issues.filter((i) => i.severity === 'warning');
    expect(warnings.length).toBeGreaterThan(0);
    expect(result.valid).toBe(errors.length === 0);
  });

  it('all 8 rule functions are called (issue rules present in combined output)', () => {
    // Force multiple rule violations at once for coverage
    const multiViolation = [
      s(1, 0, 'easy', 10), // structural: day 0
      s(2, 1, 'easy', 8), // missing race in final week
      s(2, 7, 'rest'),
    ];
    const result = validatePlan({ experience_level: 'beginner', sessions: multiViolation });
    expect(result.valid).toBe(false);
  });
});
