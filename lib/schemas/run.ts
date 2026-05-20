import { z } from 'zod';

export const RunInputSchema = z
  .object({
    run_date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be ISO date YYYY-MM-DD'),
    distance_km: z.number().min(0.1).max(100),
    duration_seconds: z.number().int().min(1).max(86399),
    avg_hr: z.number().int().min(40).max(220).optional(),
    max_hr: z.number().int().min(40).max(220).optional(),
    elevation_gain_m: z.number().int().min(0).max(5000).optional(),
    avg_cadence: z.number().int().min(40).max(220).optional(),
    rpe: z.number().int().min(1).max(10).optional(),
    felt_easy: z.boolean().optional(),
    stitch_occurred: z.boolean().optional(),
    stitch_severity: z.number().int().min(1).max(10).optional(),
    shoes: z.string().trim().max(100).optional(),
    weather: z
      .object({
        temp_c: z.number().optional(),
        conditions: z.string().trim().max(100).optional(),
        wind_kmh: z.number().min(0).optional(),
      })
      .optional(),
    notes: z.string().trim().max(1000).optional(),
    planned_session_id: z.string().uuid().optional(),
  })
  .refine((data) => !data.stitch_occurred || data.stitch_severity !== undefined, {
    message: 'stitch_severity is required when stitch_occurred is true',
    path: ['stitch_severity'],
  });

export type RunInput = z.infer<typeof RunInputSchema>;
