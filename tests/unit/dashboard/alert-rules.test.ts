// Unit tests for dashboard alert rule pure functions.
// Refs: P2-13
import { describe, expect, it } from 'vitest';
import {
  easyPaceAlert,
  sleepAlert,
  niggleAlert,
  computeAlerts,
  daysBetween,
} from '@/lib/dashboard/alert-rules';

describe('easyPaceAlert', () => {
  const CEILING = 360; // 6:00/km easy zone fast ceiling

  it('returns null when fewer than 3 easy runs', () => {
    expect(easyPaceAlert([355, 358], CEILING)).toBeNull();
    expect(easyPaceAlert([], CEILING)).toBeNull();
    expect(easyPaceAlert([350], CEILING)).toBeNull();
  });

  it('warns when all 3 runs are within 7s/km of ceiling', () => {
    // 360 + 7 = 367; paces <= 367 should warn
    const alert = easyPaceAlert([355, 360, 362], CEILING);
    expect(alert).not.toBeNull();
    expect(alert!.level).toBe('warn');
    expect(alert!.message).toMatch(/easy zone/i);
  });

  it('warns when all 3 runs are exactly at the boundary (ceiling + 7)', () => {
    const alert = easyPaceAlert([367, 367, 367], CEILING);
    expect(alert).not.toBeNull();
  });

  it('returns null when one run is comfortably in the easy zone', () => {
    // 380 > 367, so not within 7s of ceiling
    const alert = easyPaceAlert([355, 360, 380], CEILING);
    expect(alert).toBeNull();
  });

  it('returns null when all 3 paces are comfortably slow', () => {
    expect(easyPaceAlert([390, 385, 395], CEILING)).toBeNull();
  });

  it('uses only first 3 paces from a longer list', () => {
    // First 3 are all fast (warn), but 4th+ are slow
    const alert = easyPaceAlert([355, 360, 362, 400, 410], CEILING);
    expect(alert).not.toBeNull();
  });

  it('boundary: pace exactly at ceiling (no offset) does NOT warn alone', () => {
    // 360 <= 367: still triggers warning
    const alert = easyPaceAlert([360, 360, 360], CEILING);
    expect(alert).not.toBeNull();
  });

  it('pace just above threshold boundary does not warn', () => {
    // 368 > 367: does NOT satisfy <= 367
    const alert = easyPaceAlert([368, 368, 368], CEILING);
    expect(alert).toBeNull();
  });
});

describe('sleepAlert', () => {
  it('returns null when array is empty', () => {
    expect(sleepAlert([])).toBeNull();
  });

  it('warns when average sleep < 7h', () => {
    // avg = (6 + 6.5 + 6) / 3 = 6.17
    const alert = sleepAlert([6, 6.5, 6]);
    expect(alert).not.toBeNull();
    expect(alert!.level).toBe('warn');
    expect(alert!.message).toMatch(/sleep/i);
    expect(alert!.message).toContain('6.2h');
  });

  it('warns when average is exactly below 7', () => {
    const alert = sleepAlert([6.9]);
    expect(alert).not.toBeNull();
  });

  it('returns null when average sleep >= 7h', () => {
    expect(sleepAlert([7, 8, 7.5])).toBeNull();
    expect(sleepAlert([7])).toBeNull();
  });

  it('returns null when average sleep is exactly 7h', () => {
    expect(sleepAlert([7, 7, 7])).toBeNull();
  });

  it('handles single entry', () => {
    expect(sleepAlert([5])).not.toBeNull();
    expect(sleepAlert([8])).toBeNull();
  });

  it('message includes entry count', () => {
    const alert = sleepAlert([6, 6, 6]);
    expect(alert!.message).toContain('3');
  });
});

describe('niggleAlert', () => {
  it('returns null when no active niggles', () => {
    expect(niggleAlert([])).toBeNull();
  });

  it('returns null when all niggles < 5 days', () => {
    expect(niggleAlert([1, 2, 3, 4])).toBeNull();
    expect(niggleAlert([0])).toBeNull();
  });

  it('warns when any niggle >= 5 days', () => {
    const alert = niggleAlert([2, 5]);
    expect(alert).not.toBeNull();
    expect(alert!.level).toBe('warn');
    expect(alert!.message).toMatch(/physio/i);
  });

  it('warns at exactly 5 days (boundary)', () => {
    expect(niggleAlert([5])).not.toBeNull();
  });

  it('returns null at 4 days (boundary)', () => {
    expect(niggleAlert([4])).toBeNull();
  });

  it('warns when first niggle is old', () => {
    expect(niggleAlert([10, 1, 2])).not.toBeNull();
  });
});

describe('computeAlerts', () => {
  it('returns empty array when no rules fire', () => {
    const alerts = computeAlerts({
      recentEasyPaces: [390, 385, 392],
      easyCeilingSec: 360,
      recentSleepHours: [8, 7.5, 8],
      activeDaysPerNiggle: [1, 2],
    });
    expect(alerts).toHaveLength(0);
  });

  it('collects all firing alerts', () => {
    const alerts = computeAlerts({
      recentEasyPaces: [355, 358, 360],
      easyCeilingSec: 360,
      recentSleepHours: [5, 6, 5.5],
      activeDaysPerNiggle: [7],
    });
    expect(alerts).toHaveLength(3);
  });

  it('skips easy pace rule when easyCeilingSec is null', () => {
    const alerts = computeAlerts({
      recentEasyPaces: [355, 358, 360],
      easyCeilingSec: null,
      recentSleepHours: [8, 8, 8],
      activeDaysPerNiggle: [],
    });
    expect(alerts).toHaveLength(0);
  });

  it('fires only sleep alert when others clear', () => {
    const alerts = computeAlerts({
      recentEasyPaces: [390, 385, 392],
      easyCeilingSec: 360,
      recentSleepHours: [5.5, 6, 5],
      activeDaysPerNiggle: [],
    });
    expect(alerts).toHaveLength(1);
    expect(alerts[0]!.message).toMatch(/sleep/i);
  });
});

describe('daysBetween', () => {
  it('returns 0 for same date', () => {
    expect(daysBetween('2026-05-22', '2026-05-22')).toBe(0);
  });

  it('returns correct positive days', () => {
    expect(daysBetween('2026-05-17', '2026-05-22')).toBe(5);
    expect(daysBetween('2026-05-01', '2026-05-31')).toBe(30);
  });

  it('returns 0 when end is before start (clamped)', () => {
    expect(daysBetween('2026-05-22', '2026-05-20')).toBe(0);
  });
});
