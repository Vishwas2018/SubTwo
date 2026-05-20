import { describe, expect, it } from 'vitest';
import {
  PaceZoneSchema,
  PaceZonesSchema,
  PlannedSessionSchema,
  WeekSchema,
  CheckpointSpecSchema,
  GeneratedPlanSchema,
} from '@/lib/schemas/plan';

const validZone = {
  min_seconds_per_km: 420,
  max_seconds_per_km: 360,
  rpe_min: 3,
  rpe_max: 5,
};

const validPaceZones = {
  recovery: { ...validZone, rpe_min: 1, rpe_max: 2 },
  easy: { ...validZone, rpe_min: 3, rpe_max: 4 },
  long_run: { ...validZone, rpe_min: 4, rpe_max: 5 },
  marathon_pace: { ...validZone, rpe_min: 5, rpe_max: 6 },
  race_pace: { min_seconds_per_km: 350, max_seconds_per_km: 340, rpe_min: 7, rpe_max: 8 },
  threshold: { min_seconds_per_km: 335, max_seconds_per_km: 320, rpe_min: 8, rpe_max: 9 },
  interval: { min_seconds_per_km: 310, max_seconds_per_km: 290, rpe_min: 9, rpe_max: 10 },
};

const validSession = {
  week_number: 1,
  day_of_week: 1,
  session_type: 'easy' as const,
  distance_km: 8,
};

const validRestSession = {
  week_number: 1,
  day_of_week: 7,
  session_type: 'rest' as const,
};

const validWeek = {
  week_number: 1,
  total_km: 40,
  sessions: [validSession, validRestSession],
};

const validCheckpoint = {
  week: 4,
  type: '10k',
  target_seconds: 2700,
  target_distance_km: 10,
};

function buildValidPlan(weeks = 2) {
  return {
    summary: {
      philosophy: 'Build aerobic base with controlled progression.',
      weekly_pattern: 'Mon easy, Wed threshold, Sat long run, Sun rest.',
    },
    pace_zones: validPaceZones,
    checkpoints: [validCheckpoint],
    weeks: Array.from({ length: weeks }, (_, i) => ({
      ...validWeek,
      week_number: i + 1,
    })),
    total_weeks: weeks,
  };
}

// ─── PaceZoneSchema ────────────────────────────────────────────────────────────

describe('PaceZoneSchema', () => {
  it('valid pace zone → passes', () => {
    expect(PaceZoneSchema.safeParse(validZone).success).toBe(true);
  });

  it('rpe_max = 11 → fails', () => {
    expect(PaceZoneSchema.safeParse({ ...validZone, rpe_max: 11 }).success).toBe(false);
  });

  it('rpe_min = 0 → fails', () => {
    expect(PaceZoneSchema.safeParse({ ...validZone, rpe_min: 0 }).success).toBe(false);
  });

  it('missing min_seconds_per_km → fails', () => {
    expect(PaceZoneSchema.safeParse({ max_seconds_per_km: 360, rpe_min: 3, rpe_max: 5 }).success).toBe(false);
  });
});

// ─── PaceZonesSchema ───────────────────────────────────────────────────────────

describe('PaceZonesSchema', () => {
  it('valid 7-zone object → passes', () => {
    expect(PaceZonesSchema.safeParse(validPaceZones).success).toBe(true);
  });

  it('missing threshold zone → fails', () => {
    const noThreshold = { ...validPaceZones, threshold: undefined };
    expect(PaceZonesSchema.safeParse(noThreshold).success).toBe(false);
  });
});

// ─── PlannedSessionSchema ─────────────────────────────────────────────────────

describe('PlannedSessionSchema', () => {
  it('valid easy session → passes', () => {
    expect(PlannedSessionSchema.safeParse(validSession).success).toBe(true);
  });

  it('rest session (no distance) → passes', () => {
    expect(PlannedSessionSchema.safeParse(validRestSession).success).toBe(true);
  });

  it('invalid session_type → fails', () => {
    expect(PlannedSessionSchema.safeParse({ ...validSession, session_type: 'sprint' }).success).toBe(false);
  });

  it('day_of_week = 0 → fails', () => {
    expect(PlannedSessionSchema.safeParse({ ...validSession, day_of_week: 0 }).success).toBe(false);
  });

  it('day_of_week = 8 → fails', () => {
    expect(PlannedSessionSchema.safeParse({ ...validSession, day_of_week: 8 }).success).toBe(false);
  });

  it('all session types are valid enum values', () => {
    const types = ['easy', 'long_run', 'threshold', 'interval', 'recovery', 'rest', 'race', 'time_trial', 'marathon_pace'];
    for (const t of types) {
      expect(PlannedSessionSchema.safeParse({ ...validSession, session_type: t }).success).toBe(true);
    }
  });
});

// ─── WeekSchema ───────────────────────────────────────────────────────────────

describe('WeekSchema', () => {
  it('valid week → passes', () => {
    expect(WeekSchema.safeParse(validWeek).success).toBe(true);
  });

  it('week_number = 0 → fails', () => {
    expect(WeekSchema.safeParse({ ...validWeek, week_number: 0 }).success).toBe(false);
  });

  it('week_number = 53 → fails', () => {
    expect(WeekSchema.safeParse({ ...validWeek, week_number: 53 }).success).toBe(false);
  });
});

// ─── CheckpointSpecSchema ─────────────────────────────────────────────────────

describe('CheckpointSpecSchema', () => {
  it('valid checkpoint → passes', () => {
    expect(CheckpointSpecSchema.safeParse(validCheckpoint).success).toBe(true);
  });

  it('target_distance_km = 0 → fails', () => {
    expect(CheckpointSpecSchema.safeParse({ ...validCheckpoint, target_distance_km: 0 }).success).toBe(false);
  });
});

// ─── GeneratedPlanSchema ──────────────────────────────────────────────────────

describe('GeneratedPlanSchema', () => {
  it('valid 2-week plan → passes', () => {
    expect(GeneratedPlanSchema.safeParse(buildValidPlan(2)).success).toBe(true);
  });

  it('valid 16-week plan → passes', () => {
    expect(GeneratedPlanSchema.safeParse(buildValidPlan(16)).success).toBe(true);
  });

  it('total_weeks mismatches weeks.length → fails', () => {
    const plan = buildValidPlan(2);
    const r = GeneratedPlanSchema.safeParse({ ...plan, total_weeks: 3 });
    expect(r.success).toBe(false);
  });

  it('only 1 week (below min 2) → fails', () => {
    const plan = buildValidPlan(1);
    expect(GeneratedPlanSchema.safeParse(plan).success).toBe(false);
  });

  it('empty checkpoints array (below min 1) → fails', () => {
    const plan = { ...buildValidPlan(2), checkpoints: [] };
    expect(GeneratedPlanSchema.safeParse(plan).success).toBe(false);
  });

  it('6 checkpoints (above max 5) → fails', () => {
    const plan = {
      ...buildValidPlan(2),
      checkpoints: Array.from({ length: 6 }, () => validCheckpoint),
    };
    expect(GeneratedPlanSchema.safeParse(plan).success).toBe(false);
  });

  it('missing pace_zones → fails', () => {
    const noPace = { ...buildValidPlan(2), pace_zones: undefined };
    expect(GeneratedPlanSchema.safeParse(noPace).success).toBe(false);
  });

  it('plan with phase and notes in sessions → passes', () => {
    // Use unknown to pass extra fields to safeParse without TS excess-property errors
    const plan: unknown = {
      summary: { philosophy: 'Build aerobic base.', weekly_pattern: 'Easy most days.' },
      pace_zones: validPaceZones,
      checkpoints: [validCheckpoint],
      weeks: [
        {
          week_number: 1,
          total_km: 40,
          sessions: [
            { week_number: 1, day_of_week: 1, session_type: 'easy', distance_km: 8, phase: 'base', notes: 'Keep HR below 140', target_pace_seconds_per_km: 360 },
            validRestSession,
          ],
        },
        { week_number: 2, total_km: 38, sessions: [validSession, validRestSession] },
      ],
      total_weeks: 2,
    };
    expect(GeneratedPlanSchema.safeParse(plan).success).toBe(true);
  });
});
