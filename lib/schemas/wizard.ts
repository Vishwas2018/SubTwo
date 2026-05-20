import { z } from 'zod';

// ─── Shared helpers ───────────────────────────────────────────────────────────

const str = (max: number) => z.string().trim().max(max);

const LONG_RUN_DAY_ENUM = z.enum(['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']);

// ISO date that must be in the future (compared at parse time)
const FutureDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be ISO date YYYY-MM-DD')
  .refine((val) => new Date(val + 'T00:00:00Z') > new Date(), {
    message: 'race_date must be a future date',
  });

const OptionalFields = z.object({
  injury_history: str(500).optional(),
  notes: str(500).optional(),
  shoes: str(100).optional(),
  fuel: str(100).optional(),
  weight_kg: z.number().min(30).max(200).optional(),
});

const RecentRaceSchema = z.object({
  distance_km: z.number().min(1).max(100),
  time_seconds: z.number().int().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be ISO date YYYY-MM-DD'),
});

// ─── Per-level wizard data ────────────────────────────────────────────────────

export const BeginnerWizardDataSchema = OptionalFields.extend({
  weekly_km_current: z.number().min(0).max(100),
  longest_recent_run_km: z.number().min(0).max(50),
  can_run_5k_without_stopping: z.enum(['yes', 'sometimes', 'no']),
  days_per_week: z.number().int().min(3).max(7),
  long_run_day: LONG_RUN_DAY_ENUM,
});

export const IntermediateWizardDataSchema = OptionalFields.extend({
  weekly_km_current: z.number().min(0).max(200),
  recent_race: RecentRaceSchema,
  days_per_week: z.number().int().min(3).max(7),
  long_run_day: LONG_RUN_DAY_ENUM,
  goal_time_seconds: z.number().int().min(1).optional(),
});

export const AdvancedWizardDataSchema = OptionalFields.extend({
  weekly_km_current: z.number().min(0).max(300),
  peak_weekly_km: z.number().min(0).max(300),
  recent_race: RecentRaceSchema,
  threshold_pace_seconds: z.number().int().min(180).max(600).optional(),
  years_running: z.number().int().min(0).max(50),
  days_per_week: z.number().int().min(3).max(7),
  long_run_day: LONG_RUN_DAY_ENUM,
  goal_time_seconds: z.number().int().min(1).optional(),
});

// ─── Top-level discriminated union ───────────────────────────────────────────

const CommonRaceFields = z.object({
  race_distance_km: z.number().min(1).max(200),
  race_date: FutureDateSchema,
  race_name: str(200).optional(),
});

export const WizardInputSchema = z.discriminatedUnion('experience_level', [
  CommonRaceFields.extend({
    experience_level: z.literal('beginner'),
    wizard_data: BeginnerWizardDataSchema,
  }),
  CommonRaceFields.extend({
    experience_level: z.literal('intermediate'),
    wizard_data: IntermediateWizardDataSchema,
  }),
  CommonRaceFields.extend({
    experience_level: z.literal('advanced'),
    wizard_data: AdvancedWizardDataSchema,
  }),
]);

export type WizardInput = z.infer<typeof WizardInputSchema>;
export type BeginnerWizardData = z.infer<typeof BeginnerWizardDataSchema>;
export type IntermediateWizardData = z.infer<typeof IntermediateWizardDataSchema>;
export type AdvancedWizardData = z.infer<typeof AdvancedWizardDataSchema>;
