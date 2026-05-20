import { z } from 'zod';

export const CheckinInputSchema = z.object({
  checkin_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be ISO date YYYY-MM-DD'),
  sleep_hours: z.number().min(0).max(24).optional(),
  resting_hr: z.number().int().min(30).max(120).optional(),
  weight_kg: z.number().min(30).max(200).optional(),
  energy_1to5: z.number().int().min(1).max(5).optional(),
  mood_1to5: z.number().int().min(1).max(5).optional(),
  niggle_today: z.boolean().optional(),
  notes: z.string().trim().max(500).optional(),
});

export type CheckinInput = z.infer<typeof CheckinInputSchema>;
