import { describe, expect, it } from 'vitest';
import {
  VERDICT_AMBER_THRESHOLD,
  VERDICT_GREEN_THRESHOLD,
  type CheckpointVerdict,
  computeDeviation,
  computeVerdict,
  deriveCheckpointTarget,
  evaluateCheckpoint,
  recommendedAction,
  suggestCheckpoints,
} from '@/lib/checkpoint-logic';
import { predictTime } from '@/lib/pace-zones';

// ─── computeDeviation ────────────────────────────────────────────────────────

describe('computeDeviation', () => {
  it('actual equals target → 0%', () => {
    expect(computeDeviation(50, 50)).toBe(0);
  });

  it('ahead of target → positive deviation', () => {
    // actual=55, target=50 → (55-50)/50 * 100 = 10%
    expect(computeDeviation(55, 50)).toBeCloseTo(10, 5);
  });

  it('behind target → negative deviation', () => {
    // actual=45, target=50 → (45-50)/50 * 100 = -10%
    expect(computeDeviation(45, 50)).toBeCloseTo(-10, 5);
  });

  it('zero actual km → negative deviation', () => {
    // actual=0, target=50 → -100%
    expect(computeDeviation(0, 50)).toBeCloseTo(-100, 5);
  });

  it('throws on zero targetKm', () => {
    expect(() => computeDeviation(50, 0)).toThrow();
  });

  it('throws on negative targetKm', () => {
    expect(() => computeDeviation(50, -5)).toThrow();
  });

  it('throws on negative actualKm', () => {
    expect(() => computeDeviation(-1, 50)).toThrow();
  });

  it('throws on NaN targetKm', () => {
    expect(() => computeDeviation(50, NaN)).toThrow();
  });
});

// ─── computeVerdict — boundary tests ─────────────────────────────────────────

describe('computeVerdict', () => {
  it('exported threshold constants have correct values', () => {
    expect(VERDICT_GREEN_THRESHOLD).toBe(3);
    expect(VERDICT_AMBER_THRESHOLD).toBe(10);
  });

  it('0% deviation (exactly on target) → green', () => {
    expect(computeVerdict(0)).toBe('green');
  });

  it('positive deviation (ahead of target) → green', () => {
    expect(computeVerdict(5)).toBe('green');
  });

  it('exactly -3% deviation (at green boundary) → green', () => {
    // >= -VERDICT_GREEN_THRESHOLD(-3) → green
    expect(computeVerdict(-3)).toBe('green');
  });

  it('just below -3% (-3.001%) → amber', () => {
    expect(computeVerdict(-3.001)).toBe('amber');
  });

  it('exactly -10% deviation (at amber boundary) → amber', () => {
    // >= -VERDICT_AMBER_THRESHOLD(-10) → amber
    expect(computeVerdict(-10)).toBe('amber');
  });

  it('just below -10% (-10.001%) → red', () => {
    expect(computeVerdict(-10.001)).toBe('red');
  });

  it('large negative deviation (-50%) → red', () => {
    expect(computeVerdict(-50)).toBe('red');
  });
});

// ─── recommendedAction ───────────────────────────────────────────────────────

describe('recommendedAction', () => {
  it('green → "On track" message', () => {
    expect(recommendedAction('green', 12)).toMatch(/On track/);
  });

  it('amber + >=8 weeks → suggests adding easy run', () => {
    const msg = recommendedAction('amber', 8);
    expect(msg).toMatch(/adding one easy run/);
  });

  it('amber + <8 weeks → prioritise quality sessions', () => {
    const msg = recommendedAction('amber', 7);
    expect(msg).toMatch(/limited time/);
    expect(msg).toMatch(/quality sessions/);
  });

  it('red + >=8 weeks → reassess mileage', () => {
    const msg = recommendedAction('red', 10);
    expect(msg).toMatch(/Significantly behind/);
    expect(msg).toMatch(/reassess/);
  });

  it('red + <8 weeks → adjust race goal', () => {
    const msg = recommendedAction('red', 4);
    expect(msg).toMatch(/limited time/);
    expect(msg).toMatch(/race goal/);
  });

  it('all verdict types return non-empty strings', () => {
    const verdicts: CheckpointVerdict[] = ['green', 'amber', 'red'];
    for (const v of verdicts) {
      expect(recommendedAction(v, 6).length).toBeGreaterThan(0);
    }
  });
});

// ─── evaluateCheckpoint ──────────────────────────────────────────────────────

describe('evaluateCheckpoint', () => {
  it('on target → green verdict', () => {
    const result = evaluateCheckpoint({ target_km: 50, actual_km: 50, weeks_to_race: 10 });
    expect(result.verdict).toBe('green');
    expect(result.deviation_pct).toBe(0);
    expect(result.recommended_action).toMatch(/On track/);
  });

  it('5% behind → amber verdict', () => {
    const result = evaluateCheckpoint({
      target_km: 50,
      actual_km: 47.5, // -5%
      weeks_to_race: 6,
    });
    expect(result.verdict).toBe('amber');
    expect(result.deviation_pct).toBeCloseTo(-5, 4);
  });

  it('20% behind → red verdict', () => {
    const result = evaluateCheckpoint({
      target_km: 50,
      actual_km: 40, // -20%
      weeks_to_race: 4,
    });
    expect(result.verdict).toBe('red');
    expect(result.recommended_action).toMatch(/limited time/);
  });

  it('ahead by 10% → green verdict with positive deviation', () => {
    const result = evaluateCheckpoint({
      target_km: 50,
      actual_km: 55, // +10%
      weeks_to_race: 8,
    });
    expect(result.verdict).toBe('green');
    expect(result.deviation_pct).toBeCloseTo(10, 4);
  });
});

// ─── deriveCheckpointTarget ───────────────────────────────────────────────────

describe('deriveCheckpointTarget', () => {
  it('delegates to predictTime — same distance returns same time', () => {
    const result = deriveCheckpointTarget(21.1, 7200, 21.1);
    expect(result).toBeCloseTo(7200, 4);
  });

  it('shorter checkpoint distance predicts shorter time', () => {
    // 10K should be faster than 21.1K
    const predicted10k = deriveCheckpointTarget(21.1, 7200, 10);
    expect(predicted10k).toBeLessThan(7200);
  });

  it('matches predictTime directly', () => {
    const expected = predictTime(21.1, 7200, 10);
    expect(deriveCheckpointTarget(21.1, 7200, 10)).toBeCloseTo(expected, 8);
  });

  it('throws on invalid race distance', () => {
    expect(() => deriveCheckpointTarget(0, 7200, 10)).toThrow();
  });
});

// ─── suggestCheckpoints ───────────────────────────────────────────────────────

describe('suggestCheckpoints', () => {
  const HM_DIST = 21.1;
  const HM_GOAL_S = 7200; // 2:00:00 half marathon
  const TOTAL_WEEKS = 16;

  it('returns exactly 3 checkpoints', () => {
    const checkpoints = suggestCheckpoints(TOTAL_WEEKS, HM_DIST, HM_GOAL_S);
    expect(checkpoints).toHaveLength(3);
  });

  it('week numbers are at ~25%, 50%, 80% of plan duration', () => {
    const checkpoints = suggestCheckpoints(TOTAL_WEEKS, HM_DIST, HM_GOAL_S);
    expect(checkpoints[0]!.week_number).toBe(Math.round(TOTAL_WEEKS * 0.25)); // 4
    expect(checkpoints[1]!.week_number).toBe(Math.round(TOTAL_WEEKS * 0.5)); // 8
    expect(checkpoints[2]!.week_number).toBe(Math.round(TOTAL_WEEKS * 0.8)); // 13
  });

  it('target distances are at 25%, 50%, 75% of race distance', () => {
    const checkpoints = suggestCheckpoints(TOTAL_WEEKS, HM_DIST, HM_GOAL_S);
    expect(checkpoints[0]!.target_distance_km).toBeCloseTo(HM_DIST * 0.25, 5);
    expect(checkpoints[1]!.target_distance_km).toBeCloseTo(HM_DIST * 0.5, 5);
    expect(checkpoints[2]!.target_distance_km).toBeCloseTo(HM_DIST * 0.75, 5);
  });

  it('predicted times decrease as checkpoint distances decrease', () => {
    // Checkpoints are at 25%, 50%, 75% of race distance, so earlier checkpoints have shorter times
    const checkpoints = suggestCheckpoints(TOTAL_WEEKS, HM_DIST, HM_GOAL_S);
    expect(checkpoints[0]!.predicted_time_seconds).toBeLessThan(
      checkpoints[1]!.predicted_time_seconds
    );
    expect(checkpoints[1]!.predicted_time_seconds).toBeLessThan(
      checkpoints[2]!.predicted_time_seconds
    );
  });

  it('throws on totalWeeks < 1', () => {
    expect(() => suggestCheckpoints(0, HM_DIST, HM_GOAL_S)).toThrow();
  });

  it('throws on NaN totalWeeks', () => {
    expect(() => suggestCheckpoints(NaN, HM_DIST, HM_GOAL_S)).toThrow();
  });
});
