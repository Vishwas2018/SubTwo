import { describe, expect, it } from 'vitest';
import {
  BeginnerWizardDataSchema,
  IntermediateWizardDataSchema,
  AdvancedWizardDataSchema,
  WizardInputSchema,
} from '@/lib/schemas/wizard';

const FUTURE = '2027-06-01';
const PAST = '2025-01-01';

const validBeginner = {
  race_distance_km: 10,
  race_date: FUTURE,
  experience_level: 'beginner' as const,
  wizard_data: {
    weekly_km_current: 20,
    longest_recent_run_km: 8,
    can_run_5k_without_stopping: 'yes' as const,
    days_per_week: 4,
    long_run_day: 'sun' as const,
  },
};

const validIntermediate = {
  race_distance_km: 21.1,
  race_date: FUTURE,
  race_name: 'Melbourne Half',
  experience_level: 'intermediate' as const,
  wizard_data: {
    weekly_km_current: 40,
    recent_race: { distance_km: 10, time_seconds: 2700, date: '2026-03-01' },
    days_per_week: 5,
    long_run_day: 'sat' as const,
    goal_time_seconds: 7200,
  },
};

const validAdvanced = {
  race_distance_km: 42.195,
  race_date: FUTURE,
  experience_level: 'advanced' as const,
  wizard_data: {
    weekly_km_current: 80,
    peak_weekly_km: 110,
    recent_race: { distance_km: 21.1, time_seconds: 6300, date: '2026-04-01' },
    years_running: 8,
    days_per_week: 6,
    long_run_day: 'sun' as const,
  },
};

// ─── WizardInputSchema — valid inputs ─────────────────────────────────────────

describe('WizardInputSchema — valid', () => {
  it('valid beginner input parses successfully', () => {
    const r = WizardInputSchema.safeParse(validBeginner);
    expect(r.success).toBe(true);
  });

  it('valid intermediate input with recent_race → passes', () => {
    const r = WizardInputSchema.safeParse(validIntermediate);
    expect(r.success).toBe(true);
  });

  it('valid advanced input with all required fields → passes', () => {
    const r = WizardInputSchema.safeParse(validAdvanced);
    expect(r.success).toBe(true);
  });

  it('optional race_name included → passes', () => {
    const r = WizardInputSchema.safeParse({ ...validBeginner, race_name: 'City 10K' });
    expect(r.success).toBe(true);
  });

  it('optional injury_history and notes in wizard_data → passes', () => {
    const r = WizardInputSchema.safeParse({
      ...validBeginner,
      wizard_data: { ...validBeginner.wizard_data, injury_history: 'knee niggle', notes: 'goal: finish' },
    });
    expect(r.success).toBe(true);
    if (r.success && r.data.experience_level === 'beginner') {
      expect(r.data.wizard_data.injury_history).toBe('knee niggle');
    }
  });
});

// ─── WizardInputSchema — race_date validation ─────────────────────────────────

describe('WizardInputSchema — race_date', () => {
  it('future race_date → passes', () => {
    const r = WizardInputSchema.safeParse({ ...validBeginner, race_date: FUTURE });
    expect(r.success).toBe(true);
  });

  it('past race_date → fails with future date message', () => {
    const r = WizardInputSchema.safeParse({ ...validBeginner, race_date: PAST });
    expect(r.success).toBe(false);
  });

  it('non-ISO date string → fails', () => {
    const r = WizardInputSchema.safeParse({ ...validBeginner, race_date: '01/06/2027' });
    expect(r.success).toBe(false);
  });

  it('race_distance_km = 0 → fails', () => {
    const r = WizardInputSchema.safeParse({ ...validBeginner, race_distance_km: 0 });
    expect(r.success).toBe(false);
  });

  it('race_distance_km = 201 → fails', () => {
    const r = WizardInputSchema.safeParse({ ...validBeginner, race_distance_km: 201 });
    expect(r.success).toBe(false);
  });
});

// ─── WizardInputSchema — beginner branch validation ───────────────────────────

describe('WizardInputSchema — beginner branch', () => {
  it('missing can_run_5k_without_stopping → fails', () => {
    const r = WizardInputSchema.safeParse({
      ...validBeginner,
      wizard_data: { weekly_km_current: 20, longest_recent_run_km: 8, days_per_week: 4, long_run_day: 'sun' },
    });
    expect(r.success).toBe(false);
  });

  it('days_per_week = 2 (below min 3) → fails', () => {
    const r = WizardInputSchema.safeParse({
      ...validBeginner,
      wizard_data: { ...validBeginner.wizard_data, days_per_week: 2 },
    });
    expect(r.success).toBe(false);
  });

  it('days_per_week = 8 (above max 7) → fails', () => {
    const r = WizardInputSchema.safeParse({
      ...validBeginner,
      wizard_data: { ...validBeginner.wizard_data, days_per_week: 8 },
    });
    expect(r.success).toBe(false);
  });

  it('weekly_km_current = 101 (above max 100) → fails', () => {
    const r = WizardInputSchema.safeParse({
      ...validBeginner,
      wizard_data: { ...validBeginner.wizard_data, weekly_km_current: 101 },
    });
    expect(r.success).toBe(false);
  });
});

// ─── WizardInputSchema — string sanitization ──────────────────────────────────

describe('WizardInputSchema — string sanitization', () => {
  it('leading/trailing whitespace in race_name is trimmed', () => {
    const r = WizardInputSchema.safeParse({ ...validBeginner, race_name: '  City Run  ' });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.race_name).toBe('City Run');
  });

  it('injury_history at max 500 chars → passes', () => {
    const r = WizardInputSchema.safeParse({
      ...validBeginner,
      wizard_data: { ...validBeginner.wizard_data, injury_history: 'x'.repeat(500) },
    });
    expect(r.success).toBe(true);
  });

  it('injury_history exceeding 500 chars → fails', () => {
    const r = WizardInputSchema.safeParse({
      ...validBeginner,
      wizard_data: { ...validBeginner.wizard_data, injury_history: 'x'.repeat(501) },
    });
    expect(r.success).toBe(false);
  });

  it('race_name at max 200 chars → passes', () => {
    const r = WizardInputSchema.safeParse({ ...validBeginner, race_name: 'a'.repeat(200) });
    expect(r.success).toBe(true);
  });

  it('race_name exceeding 200 chars → fails', () => {
    const r = WizardInputSchema.safeParse({ ...validBeginner, race_name: 'a'.repeat(201) });
    expect(r.success).toBe(false);
  });
});

// ─── Individual wizard data schemas ──────────────────────────────────────────

describe('BeginnerWizardDataSchema', () => {
  it('valid beginner data → passes', () => {
    expect(BeginnerWizardDataSchema.safeParse(validBeginner.wizard_data).success).toBe(true);
  });

  it('invalid can_run_5k value → fails', () => {
    const r = BeginnerWizardDataSchema.safeParse({
      ...validBeginner.wizard_data,
      can_run_5k_without_stopping: 'maybe',
    });
    expect(r.success).toBe(false);
  });
});

describe('IntermediateWizardDataSchema', () => {
  it('valid intermediate data → passes', () => {
    expect(IntermediateWizardDataSchema.safeParse(validIntermediate.wizard_data).success).toBe(true);
  });

  it('missing recent_race → fails', () => {
    expect(IntermediateWizardDataSchema.safeParse({
      weekly_km_current: 40, days_per_week: 5, long_run_day: 'sat',
    }).success).toBe(false);
  });
});

describe('AdvancedWizardDataSchema', () => {
  it('valid advanced data → passes', () => {
    expect(AdvancedWizardDataSchema.safeParse(validAdvanced.wizard_data).success).toBe(true);
  });

  it('missing peak_weekly_km → fails', () => {
    expect(AdvancedWizardDataSchema.safeParse({
      weekly_km_current: 80,
      recent_race: { distance_km: 21.1, time_seconds: 6300, date: '2026-04-01' },
      years_running: 8, days_per_week: 6, long_run_day: 'sun',
    }).success).toBe(false);
  });

  it('threshold_pace_seconds below 180 → fails', () => {
    const r = AdvancedWizardDataSchema.safeParse({
      ...validAdvanced.wizard_data,
      threshold_pace_seconds: 179,
    });
    expect(r.success).toBe(false);
  });
});
