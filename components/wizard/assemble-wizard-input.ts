import { WizardInputSchema, type WizardInput } from '@/lib/schemas';
import { type WizardFormData, timeToSeconds } from './wizard-types';

/**
 * Assembles a WizardInput from the raw form data.
 * Returns { success: true, data } or { success: false, error }.
 */
export function assembleWizardInput(
  form: WizardFormData,
): { success: true; data: WizardInput } | { success: false; error: string } {
  const level = form.experience_level;
  if (!level) return { success: false, error: 'Experience level is required.' };

  const goalTimeSecs =
    form.goal_type === 'specific' ? timeToSeconds(form.goal_time) : null;

  let wizardData: Record<string, unknown>;

  if (level === 'beginner') {
    wizardData = {
      weekly_km_current: parseFloat(form.weekly_km_current),
      longest_recent_run_km: parseFloat(form.longest_recent_run_km),
      can_run_5k_without_stopping: form.can_run_5k_without_stopping || undefined,
      days_per_week: parseInt(form.days_per_week),
      long_run_day: form.long_run_day || undefined,
      ...(form.injury_history ? { injury_history: form.injury_history } : {}),
      ...(form.notes ? { notes: form.notes } : {}),
      ...(form.shoes ? { shoes: form.shoes } : {}),
      ...(form.fuel ? { fuel: form.fuel } : {}),
      ...(form.weight_kg ? { weight_kg: parseFloat(form.weight_kg) } : {}),
    };
  } else {
    const recentTimeSecs = timeToSeconds(form.recent_race_time);
    const sharedFields = {
      weekly_km_current: parseFloat(form.weekly_km_current),
      recent_race: {
        distance_km: parseFloat(form.recent_race_distance_km),
        time_seconds: recentTimeSecs ?? 0,
        date: form.recent_race_date,
      },
      days_per_week: parseInt(form.days_per_week),
      long_run_day: form.long_run_day || undefined,
      ...(goalTimeSecs ? { goal_time_seconds: goalTimeSecs } : {}),
      ...(form.injury_history ? { injury_history: form.injury_history } : {}),
      ...(form.notes ? { notes: form.notes } : {}),
      ...(form.shoes ? { shoes: form.shoes } : {}),
      ...(form.fuel ? { fuel: form.fuel } : {}),
      ...(form.weight_kg ? { weight_kg: parseFloat(form.weight_kg) } : {}),
    };

    if (level === 'intermediate') {
      wizardData = sharedFields;
    } else {
      // advanced
      const thresholdSecs = timeToSeconds(form.threshold_pace_time);
      wizardData = {
        ...sharedFields,
        peak_weekly_km: parseFloat(form.peak_weekly_km),
        years_running: parseInt(form.years_running),
        ...(thresholdSecs ? { threshold_pace_seconds: thresholdSecs } : {}),
      };
    }
  }

  const raw = {
    race_distance_km: parseFloat(form.race_distance_km),
    race_date: form.race_date,
    ...(form.race_name ? { race_name: form.race_name } : {}),
    experience_level: level,
    wizard_data: wizardData,
  };

  const result = WizardInputSchema.safeParse(raw);
  if (!result.success) {
    return { success: false, error: result.error.issues?.[0]?.message ?? 'Validation failed.' };
  }
  return { success: true, data: result.data };
}
