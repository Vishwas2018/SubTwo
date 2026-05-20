import { describe, expect, it } from 'vitest';
import { RunInputSchema } from '@/lib/schemas/run';

const validRun = {
  run_date: '2026-06-15',
  distance_km: 10,
  duration_seconds: 3600,
};

const fullRun = {
  run_date: '2026-06-15',
  distance_km: 12.5,
  duration_seconds: 4200,
  avg_hr: 145,
  max_hr: 168,
  elevation_gain_m: 120,
  avg_cadence: 174,
  rpe: 6,
  felt_easy: false,
  stitch_occurred: false,
  shoes: 'Nike Pegasus 41',
  weather: { temp_c: 18, conditions: 'cloudy', wind_kmh: 10 },
  notes: 'Good progression run',
  planned_session_id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
};

// ─── Valid inputs ─────────────────────────────────────────────────────────────

describe('RunInputSchema — valid', () => {
  it('minimal valid run → passes', () => {
    expect(RunInputSchema.safeParse(validRun).success).toBe(true);
  });

  it('full run with all optional fields → passes', () => {
    expect(RunInputSchema.safeParse(fullRun).success).toBe(true);
  });

  it('stitch_occurred=true with stitch_severity → passes', () => {
    const r = RunInputSchema.safeParse({
      ...validRun,
      stitch_occurred: true,
      stitch_severity: 4,
    });
    expect(r.success).toBe(true);
  });

  it('stitch_occurred=false without stitch_severity → passes', () => {
    const r = RunInputSchema.safeParse({ ...validRun, stitch_occurred: false });
    expect(r.success).toBe(true);
  });

  it('stitch_occurred omitted without stitch_severity → passes', () => {
    expect(RunInputSchema.safeParse(validRun).success).toBe(true);
  });

  it('weather without optional fields → passes', () => {
    const r = RunInputSchema.safeParse({ ...validRun, weather: {} });
    expect(r.success).toBe(true);
  });
});

// ─── Stitch refinement ────────────────────────────────────────────────────────

describe('RunInputSchema — stitch refinement', () => {
  it('stitch_occurred=true WITHOUT stitch_severity → fails', () => {
    const r = RunInputSchema.safeParse({ ...validRun, stitch_occurred: true });
    expect(r.success).toBe(false);
    if (!r.success) {
      const path = r.error.issues[0]?.path;
      expect(path).toContain('stitch_severity');
    }
  });
});

// ─── Distance and duration ────────────────────────────────────────────────────

describe('RunInputSchema — distance and duration bounds', () => {
  it('distance_km = 0.05 (below min 0.1) → fails', () => {
    expect(RunInputSchema.safeParse({ ...validRun, distance_km: 0.05 }).success).toBe(false);
  });

  it('distance_km = 100 → passes', () => {
    expect(RunInputSchema.safeParse({ ...validRun, distance_km: 100 }).success).toBe(true);
  });

  it('distance_km = 101 → fails', () => {
    expect(RunInputSchema.safeParse({ ...validRun, distance_km: 101 }).success).toBe(false);
  });

  it('duration_seconds = 86399 (max allowed) → passes', () => {
    expect(RunInputSchema.safeParse({ ...validRun, duration_seconds: 86399 }).success).toBe(true);
  });

  it('duration_seconds = 86400 (exceeds max) → fails', () => {
    expect(RunInputSchema.safeParse({ ...validRun, duration_seconds: 86400 }).success).toBe(false);
  });

  it('duration_seconds = 0 → fails', () => {
    expect(RunInputSchema.safeParse({ ...validRun, duration_seconds: 0 }).success).toBe(false);
  });
});

// ─── Field bounds ─────────────────────────────────────────────────────────────

describe('RunInputSchema — field bounds', () => {
  it('avg_hr = 39 → fails', () => {
    expect(RunInputSchema.safeParse({ ...validRun, avg_hr: 39 }).success).toBe(false);
  });

  it('avg_hr = 221 → fails', () => {
    expect(RunInputSchema.safeParse({ ...validRun, avg_hr: 221 }).success).toBe(false);
  });

  it('rpe = 0 → fails', () => {
    expect(RunInputSchema.safeParse({ ...validRun, rpe: 0 }).success).toBe(false);
  });

  it('rpe = 11 → fails', () => {
    expect(RunInputSchema.safeParse({ ...validRun, rpe: 11 }).success).toBe(false);
  });

  it('invalid UUID for planned_session_id → fails', () => {
    expect(RunInputSchema.safeParse({ ...validRun, planned_session_id: 'not-a-uuid' }).success).toBe(false);
  });

  it('notes exceeding 1000 chars → fails', () => {
    expect(RunInputSchema.safeParse({ ...validRun, notes: 'x'.repeat(1001) }).success).toBe(false);
  });

  it('notes trimmed of whitespace', () => {
    const r = RunInputSchema.safeParse({ ...validRun, notes: '  great run  ' });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.notes).toBe('great run');
  });

  it('invalid run_date format → fails', () => {
    expect(RunInputSchema.safeParse({ ...validRun, run_date: '2026/06/15' }).success).toBe(false);
  });
});
