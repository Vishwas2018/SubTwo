import { describe, expect, it } from 'vitest';
import { CheckinInputSchema } from '@/lib/schemas/checkin';

const validCheckin = {
  checkin_date: '2026-06-15',
};

const fullCheckin = {
  checkin_date: '2026-06-15',
  sleep_hours: 7.5,
  resting_hr: 52,
  weight_kg: 72.5,
  energy_1to5: 4,
  mood_1to5: 4,
  niggle_today: false,
  notes: 'Felt rested this morning.',
};

// ─── Valid inputs ─────────────────────────────────────────────────────────────

describe('CheckinInputSchema — valid', () => {
  it('minimal checkin (date only) → passes', () => {
    expect(CheckinInputSchema.safeParse(validCheckin).success).toBe(true);
  });

  it('full checkin with all fields → passes', () => {
    expect(CheckinInputSchema.safeParse(fullCheckin).success).toBe(true);
  });

  it('sleep_hours = 0 → passes', () => {
    expect(CheckinInputSchema.safeParse({ ...validCheckin, sleep_hours: 0 }).success).toBe(true);
  });

  it('sleep_hours = 24 → passes', () => {
    expect(CheckinInputSchema.safeParse({ ...validCheckin, sleep_hours: 24 }).success).toBe(true);
  });

  it('energy_1to5 = 1 → passes', () => {
    expect(CheckinInputSchema.safeParse({ ...validCheckin, energy_1to5: 1 }).success).toBe(true);
  });

  it('energy_1to5 = 5 → passes', () => {
    expect(CheckinInputSchema.safeParse({ ...validCheckin, energy_1to5: 5 }).success).toBe(true);
  });

  it('niggle_today = true → passes', () => {
    expect(CheckinInputSchema.safeParse({ ...validCheckin, niggle_today: true }).success).toBe(true);
  });
});

// ─── Bound violations ─────────────────────────────────────────────────────────

describe('CheckinInputSchema — bound violations', () => {
  it('sleep_hours = 25 → fails', () => {
    expect(CheckinInputSchema.safeParse({ ...validCheckin, sleep_hours: 25 }).success).toBe(false);
  });

  it('sleep_hours = -1 → fails', () => {
    expect(CheckinInputSchema.safeParse({ ...validCheckin, sleep_hours: -1 }).success).toBe(false);
  });

  it('resting_hr = 29 → fails', () => {
    expect(CheckinInputSchema.safeParse({ ...validCheckin, resting_hr: 29 }).success).toBe(false);
  });

  it('resting_hr = 121 → fails', () => {
    expect(CheckinInputSchema.safeParse({ ...validCheckin, resting_hr: 121 }).success).toBe(false);
  });

  it('energy_1to5 = 0 → fails', () => {
    expect(CheckinInputSchema.safeParse({ ...validCheckin, energy_1to5: 0 }).success).toBe(false);
  });

  it('energy_1to5 = 6 → fails', () => {
    expect(CheckinInputSchema.safeParse({ ...validCheckin, energy_1to5: 6 }).success).toBe(false);
  });

  it('mood_1to5 = 6 → fails', () => {
    expect(CheckinInputSchema.safeParse({ ...validCheckin, mood_1to5: 6 }).success).toBe(false);
  });

  it('weight_kg = 29 → fails', () => {
    expect(CheckinInputSchema.safeParse({ ...validCheckin, weight_kg: 29 }).success).toBe(false);
  });
});

// ─── Date format ──────────────────────────────────────────────────────────────

describe('CheckinInputSchema — checkin_date format', () => {
  it('valid ISO date → passes', () => {
    expect(CheckinInputSchema.safeParse({ checkin_date: '2026-12-31' }).success).toBe(true);
  });

  it('non-ISO format → fails', () => {
    expect(CheckinInputSchema.safeParse({ checkin_date: '15/06/2026' }).success).toBe(false);
  });

  it('ISO datetime string → fails', () => {
    expect(
      CheckinInputSchema.safeParse({ checkin_date: '2026-06-15T00:00:00Z' }).success
    ).toBe(false);
  });

  it('notes trimmed of whitespace', () => {
    const r = CheckinInputSchema.safeParse({ ...validCheckin, notes: '  morning check  ' });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.notes).toBe('morning check');
  });

  it('notes exceeding 500 chars → fails', () => {
    expect(
      CheckinInputSchema.safeParse({ ...validCheckin, notes: 'x'.repeat(501) }).success
    ).toBe(false);
  });
});
