import { z } from 'zod';

// ─── Pace zones ───────────────────────────────────────────────────────────────

export const PaceZoneSchema = z.object({
  min_seconds_per_km: z.number().int().min(60).max(1200),
  max_seconds_per_km: z.number().int().min(60).max(1200),
  rpe_min: z.number().int().min(1).max(10),
  rpe_max: z.number().int().min(1).max(10),
});

export const PaceZonesSchema = z.object({
  recovery: PaceZoneSchema,
  easy: PaceZoneSchema,
  long_run: PaceZoneSchema,
  marathon_pace: PaceZoneSchema,
  race_pace: PaceZoneSchema,
  threshold: PaceZoneSchema,
  interval: PaceZoneSchema,
});

// ─── Session ──────────────────────────────────────────────────────────────────

export const SESSION_TYPE_ENUM = z.enum([
  'easy',
  'long_run',
  'threshold',
  'interval',
  'recovery',
  'rest',
  'race',
  'time_trial',
  'marathon_pace',
]);

export const PlannedSessionSchema = z.object({
  week_number: z.number().int().min(1).max(52),
  day_of_week: z.number().int().min(1).max(7),
  session_type: SESSION_TYPE_ENUM,
  distance_km: z.number().min(0).max(100).optional(),
  target_pace_seconds_per_km: z.number().int().min(60).max(900).optional(),
  duration_minutes: z.number().int().min(1).max(600).optional(),
  phase: z.string().trim().max(50).optional(),
  notes: z.string().trim().max(500).optional(),
});

// ─── Week ─────────────────────────────────────────────────────────────────────

export const WeekSchema = z.object({
  week_number: z.number().int().min(1).max(52),
  phase: z.string().trim().max(50).optional(),
  total_km: z.number().min(0).max(200),
  sessions: z.array(PlannedSessionSchema),
});

// ─── Checkpoint spec ──────────────────────────────────────────────────────────

export const CheckpointSpecSchema = z.object({
  week: z.number().int().min(1).max(52),
  type: z.string().trim().max(50),
  target_seconds: z.number().int().min(1),
  target_distance_km: z.number().min(0.1).max(200),
});

// ─── Generated plan ───────────────────────────────────────────────────────────

export const GeneratedPlanSchema = z
  .object({
    summary: z.object({
      philosophy: z.string().trim().max(2000),
      weekly_pattern: z.string().trim().max(2000),
    }),
    pace_zones: PaceZonesSchema,
    checkpoints: z.array(CheckpointSpecSchema).min(1).max(5),
    weeks: z.array(WeekSchema).min(2).max(52),
    total_weeks: z.number().int().min(2).max(52),
  })
  .refine((data) => data.total_weeks === data.weeks.length, {
    message: 'total_weeks must equal weeks.length',
    path: ['total_weeks'],
  });

export type PaceZone = z.infer<typeof PaceZoneSchema>;
export type PaceZones = z.infer<typeof PaceZonesSchema>;
export type PlannedSessionInput = z.infer<typeof PlannedSessionSchema>;
export type GeneratedPlan = z.infer<typeof GeneratedPlanSchema>;

// ─── Batch generation schemas ─────────────────────────────────────────────────

export const WeekMetaSchema = z.object({
  week_number: z.number().int().min(1).max(52),
  phase: z.string().trim().max(50),
  total_km: z.number().min(0).max(200),
  is_deload: z.boolean(),
});

export const PlanSkeletonSchema = z
  .object({
    summary: z.object({
      philosophy: z.string().trim().max(2000),
      weekly_pattern: z.string().trim().max(2000),
    }),
    pace_zones: PaceZonesSchema,
    checkpoints: z.array(CheckpointSpecSchema).min(1).max(5),
    weeks_meta: z.array(WeekMetaSchema).min(2).max(52),
    total_weeks: z.number().int().min(2).max(52),
  })
  .refine((data) => data.total_weeks === data.weeks_meta.length, {
    message: 'total_weeks must equal weeks_meta.length',
    path: ['total_weeks'],
  });

export const WeekBatchSchema = z.object({
  weeks: z.array(WeekSchema).min(1).max(8),
});

export type WeekMeta = z.infer<typeof WeekMetaSchema>;
export type PlanSkeleton = z.infer<typeof PlanSkeletonSchema>;
export type WeekBatch = z.infer<typeof WeekBatchSchema>;
