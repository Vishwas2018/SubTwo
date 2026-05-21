import { describe, it, expect } from 'vitest';
import { generatePlan } from '@/lib/ai/anthropic-client';
import { validatePlan } from '@/lib/plan-validators';
import type { WizardInput } from '@/lib/schemas';

const HALF_MARATHON_INPUT: WizardInput = {
  race_distance_km: 21.1,
  race_date: '2027-03-01',
  race_name: 'Sub-2 Half Marathon',
  experience_level: 'intermediate',
  wizard_data: {
    weekly_km_current: 50,
    recent_race: { distance_km: 10, time_seconds: 2700, date: '2026-01-01' }, // 45:00 10K
    days_per_week: 5,
    long_run_day: 'sat',
    goal_time_seconds: 6900, // 1:55:00 HM
  },
};

describe.skipIf(!process.env.ANTHROPIC_API_KEY)('live AI generation', () => {
  it(
    'generates a valid plan that passes Zod + business rules',
    async () => {
      const result = await generatePlan(HALF_MARATHON_INPUT, { maxRetries: 2 });

      console.log(
        `Live test: success=${result.success}, attempts=${result.attempts}, durationMs=${result.durationMs}`,
      );

      if (!result.success) {
        console.error(`Failed: stage=${result.stage}, error=${result.error}`);
      }

      expect(result.success).toBe(true);
      if (!result.success) return;

      const { plan, usage } = result;

      console.log(
        `Tokens: input=${usage.input_tokens}, output=${usage.output_tokens}`,
      );
      // Rough cost estimate: ~$3/M input + $15/M output for claude-sonnet-4
      const costUsd =
        (usage.input_tokens / 1_000_000) * 3 + (usage.output_tokens / 1_000_000) * 15;
      console.log(`Estimated cost: $${costUsd.toFixed(4)}`);

      // total_weeks matches weeks array
      expect(plan.total_weeks).toBe(plan.weeks.length);

      // Plan passes business rule validator
      const sessions = plan.weeks.flatMap((w) =>
        w.sessions.map((s) => ({
          week_number: s.week_number,
          day_of_week: s.day_of_week,
          session_type: s.session_type,
          distance_km: s.distance_km,
          target_pace_seconds_per_km: s.target_pace_seconds_per_km,
        })),
      );
      const validation = validatePlan({
        experience_level: HALF_MARATHON_INPUT.experience_level,
        sessions,
      });
      const errors = validation.issues.filter((i) => i.severity === 'error');
      if (errors.length > 0) {
        console.error('Business rule errors:', errors.map((e) => e.message));
      }
      expect(errors).toHaveLength(0);
    },
    120_000, // 2 min timeout for live API call
  );
});
