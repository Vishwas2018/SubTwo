import { describe, expect, it } from 'vitest';
import {
  KM_PER_MILE,
  deriveZonesFromGoal,
  goalPace,
  paceKmToMile,
  predictTime,
  secondsToTimeString,
  timeStringToSeconds,
  validateGoalPlausibility,
} from '@/lib/pace-zones';

// ─── timeStringToSeconds ──────────────────────────────────────────────────────

describe('timeStringToSeconds', () => {
  it('parses H:MM:SS correctly — 1:59:59 → 7199', () => {
    expect(timeStringToSeconds('1:59:59')).toBe(7199);
  });

  it('parses MM:SS correctly — 29:45 → 1785', () => {
    expect(timeStringToSeconds('29:45')).toBe(1785);
  });

  it('parses M:SS correctly — 0:30 → 30', () => {
    expect(timeStringToSeconds('0:30')).toBe(30);
  });

  it('parses 30:00 → 1800', () => {
    expect(timeStringToSeconds('30:00')).toBe(1800);
  });

  it('parses 1:00:00 → 3600', () => {
    expect(timeStringToSeconds('1:00:00')).toBe(3600);
  });

  it('throws on non-numeric string', () => {
    expect(() => timeStringToSeconds('abc')).toThrow();
  });

  it('throws on too many segments', () => {
    expect(() => timeStringToSeconds('1:2:3:4')).toThrow();
  });

  it('throws on seconds >= 60', () => {
    expect(() => timeStringToSeconds('29:60')).toThrow();
  });

  it('throws on minutes >= 60 in H:MM:SS', () => {
    expect(() => timeStringToSeconds('1:60:00')).toThrow();
  });

  it('throws on empty string', () => {
    expect(() => timeStringToSeconds('')).toThrow();
  });

  it('throws on non-integer segment (e.g. "29:45.5")', () => {
    expect(() => timeStringToSeconds('29:45.5')).toThrow();
  });

  it('throws on zero-second time ("0:00")', () => {
    expect(() => timeStringToSeconds('0:00')).toThrow();
  });
});

// ─── secondsToTimeString ──────────────────────────────────────────────────────

describe('secondsToTimeString', () => {
  it('7199 → "1:59:59"', () => {
    expect(secondsToTimeString(7199)).toBe('1:59:59');
  });

  it('1785 → "29:45"', () => {
    expect(secondsToTimeString(1785)).toBe('29:45');
  });

  it('30 → "0:30"', () => {
    expect(secondsToTimeString(30)).toBe('0:30');
  });

  it('3600 → "1:00:00" (hours present)', () => {
    expect(secondsToTimeString(3600)).toBe('1:00:00');
  });

  it('1800 → "30:00"', () => {
    expect(secondsToTimeString(1800)).toBe('30:00');
  });

  it('forceHours: 1800 → "0:30:00"', () => {
    expect(secondsToTimeString(1800, { forceHours: true })).toBe('0:30:00');
  });

  it('throws on negative seconds', () => {
    expect(() => secondsToTimeString(-1)).toThrow();
  });

  it('throws on NaN', () => {
    expect(() => secondsToTimeString(NaN)).toThrow();
  });
});

// ─── goalPace ─────────────────────────────────────────────────────────────────

describe('goalPace', () => {
  it('21.1 km in 7199 s → ~341.18 s/km', () => {
    const pace = goalPace(21.1, 7199);
    expect(pace).toBeCloseTo(341.18, 1);
  });

  it('5 km in 1785 s → 357 s/km exactly', () => {
    expect(goalPace(5, 1785)).toBe(357);
  });

  it('42.195 km in 14400 s → ~341.27 s/km', () => {
    const pace = goalPace(42.195, 14400);
    expect(pace).toBeCloseTo(341.27, 1);
  });

  it('throws on zero distance', () => {
    expect(() => goalPace(0, 7199)).toThrow();
  });

  it('throws on negative distance', () => {
    expect(() => goalPace(-5, 7199)).toThrow();
  });

  it('throws on negative time', () => {
    expect(() => goalPace(21.1, -100)).toThrow();
  });

  it('throws on NaN inputs', () => {
    expect(() => goalPace(NaN, 7199)).toThrow();
    expect(() => goalPace(21.1, NaN)).toThrow();
  });
});

// ─── predictTime (Riegel) ─────────────────────────────────────────────────────

describe('predictTime (Riegel formula)', () => {
  it('5K in 1785 s → 10K prediction within ±50 s of ~3700 s', () => {
    const predicted = predictTime(5, 1785, 10);
    expect(predicted).toBeGreaterThan(3650);
    expect(predicted).toBeLessThan(3750);
  });

  it('10K in 3540 s → HM prediction within ±100 s of ~7820 s', () => {
    const predicted = predictTime(10, 3540, 21.0975);
    expect(predicted).toBeGreaterThan(7720);
    expect(predicted).toBeLessThan(7920);
  });

  it('HM in 7199 s → 10K prediction matches Riegel formula exactly', () => {
    const expected = 7199 * Math.pow(10 / 21.1, 1.06);
    expect(predictTime(21.1, 7199, 10)).toBeCloseTo(expected, 5);
  });

  it('10K in 3600 s → 21.1K matches Riegel formula exactly', () => {
    const expected = 3600 * Math.pow(21.1 / 10, 1.06);
    expect(predictTime(10, 3600, 21.1)).toBeCloseTo(expected, 5);
  });

  it('same distance → same time (identity)', () => {
    expect(predictTime(10, 3600, 10)).toBeCloseTo(3600, 5);
  });

  it('throws on zero known distance', () => {
    expect(() => predictTime(0, 3600, 10)).toThrow();
  });

  it('throws on zero known time', () => {
    expect(() => predictTime(10, 0, 21.1)).toThrow();
  });

  it('throws on zero target distance', () => {
    expect(() => predictTime(10, 3600, 0)).toThrow();
  });
});

// ─── deriveZonesFromGoal ──────────────────────────────────────────────────────

describe('deriveZonesFromGoal', () => {
  const HM_GOAL_S = 7199; // sub-2 half marathon
  const HM_DIST = 21.1;
  const zones = deriveZonesFromGoal(HM_DIST, HM_GOAL_S);
  const racePace = HM_GOAL_S / HM_DIST; // ~341 s/km

  it('race_pace min is slower than race_pace max (correct ordering)', () => {
    expect(zones.race_pace.min_seconds_per_km).toBeGreaterThan(zones.race_pace.max_seconds_per_km);
  });

  it('easy zone is slower than race pace (min > racePace)', () => {
    expect(zones.easy.min_seconds_per_km).toBeGreaterThan(racePace);
    expect(zones.easy.max_seconds_per_km).toBeGreaterThan(racePace);
  });

  it('threshold zone is faster than race pace (HM: max < racePace)', () => {
    expect(zones.threshold.max_seconds_per_km).toBeLessThan(racePace);
  });

  it('interval zone is faster than threshold zone', () => {
    expect(zones.interval.max_seconds_per_km).toBeLessThan(zones.threshold.max_seconds_per_km);
  });

  it('recovery zone is the slowest zone', () => {
    const allMins = [
      zones.easy.min_seconds_per_km,
      zones.long_run.min_seconds_per_km,
      zones.marathon_pace.min_seconds_per_km,
      zones.race_pace.min_seconds_per_km,
      zones.threshold.min_seconds_per_km,
      zones.interval.min_seconds_per_km,
    ];
    expect(zones.recovery.min_seconds_per_km).toBeGreaterThanOrEqual(Math.max(...allMins));
  });

  it('all zones have valid RPE ranges (1-10, min <= max)', () => {
    for (const zone of Object.values(zones)) {
      expect(zone.rpe_min).toBeGreaterThanOrEqual(1);
      expect(zone.rpe_max).toBeLessThanOrEqual(10);
      expect(zone.rpe_min).toBeLessThanOrEqual(zone.rpe_max);
    }
  });

  it('5K race: threshold band is near race pace (5K effort ≈ threshold effort)', () => {
    // For short races, 5K pace ≈ LT2 threshold — threshold zone overlaps near race pace
    const z5k = deriveZonesFromGoal(5, 1200); // 5K in 20:00, race pace = 240 s/km
    const pace5k = 1200 / 5; // 240 s/km
    // threshold max (faster bound) should be within ±20 s of race pace for short events
    expect(Math.abs(z5k.threshold.max_seconds_per_km - pace5k)).toBeLessThan(20);
  });

  it('5K zones differ from HM zones (distance-aware offsets)', () => {
    const z5k = deriveZonesFromGoal(5, 1200);
    const zHM = deriveZonesFromGoal(21.1, 1200 * Math.pow(21.1 / 5, 1.06));
    // threshold offsets are different
    expect(z5k.threshold.max_seconds_per_km).not.toBeCloseTo(zHM.threshold.max_seconds_per_km, 0);
  });

  it('marathon (42.195 km): uses full-distance offsets', () => {
    const zM = deriveZonesFromGoal(42.195, 14400); // marathon in 4:00:00
    // Marathon pace zone center should equal race pace (offset = 0)
    const mPace = 14400 / 42.195;
    const mpCenter =
      (zM.marathon_pace.min_seconds_per_km + zM.marathon_pace.max_seconds_per_km) / 2;
    expect(Math.abs(mpCenter - mPace)).toBeLessThan(6);
  });

  it('throws on zero distance', () => {
    expect(() => deriveZonesFromGoal(0, 7199)).toThrow();
  });

  it('throws on negative goal time', () => {
    expect(() => deriveZonesFromGoal(21.1, -1)).toThrow();
  });
});

// ─── validateGoalPlausibility ─────────────────────────────────────────────────

describe('validateGoalPlausibility', () => {
  it('HM sub-2 (7199 s) → plausible', () => {
    expect(validateGoalPlausibility(21.1, 7199).plausible).toBe(true);
  });

  it('5K in 14:00 (elite) → plausible', () => {
    expect(validateGoalPlausibility(5, 840).plausible).toBe(true);
  });

  it('marathon in 1:30 (5400 s) → implausible (sub-2:30/km)', () => {
    const result = validateGoalPlausibility(42.195, 5400);
    expect(result.plausible).toBe(false);
    expect(result.reason).toBeDefined();
  });

  it('HM in 5:00:00 (18000 s) → implausible (walking pace)', () => {
    const result = validateGoalPlausibility(21.1, 18000);
    expect(result.plausible).toBe(false);
    expect(result.reason).toMatch(/walking/i);
  });

  it('1 km in 2:00 (120 s) → implausible (sub-2:00/km sustained)', () => {
    expect(validateGoalPlausibility(1, 120).plausible).toBe(false);
  });

  it('zero distance → implausible', () => {
    expect(validateGoalPlausibility(0, 7199).plausible).toBe(false);
  });

  it('negative time → implausible', () => {
    expect(validateGoalPlausibility(21.1, -1).plausible).toBe(false);
  });
});

// ─── paceKmToMile ─────────────────────────────────────────────────────────────

describe('paceKmToMile', () => {
  it('360 s/km → 360 * KM_PER_MILE ≈ 579.4 s/mi', () => {
    expect(paceKmToMile(360)).toBeCloseTo(360 * KM_PER_MILE, 4);
  });

  it('uses correct KM_PER_MILE constant (1.609344)', () => {
    expect(KM_PER_MILE).toBe(1.609344);
  });

  it('throws on zero', () => {
    expect(() => paceKmToMile(0)).toThrow();
  });

  it('throws on negative', () => {
    expect(() => paceKmToMile(-60)).toThrow();
  });

  it('throws on NaN', () => {
    expect(() => paceKmToMile(NaN)).toThrow();
  });
});
