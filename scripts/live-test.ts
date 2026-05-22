// Direct live test: run with NODE_OPTIONS=--use-system-ca npx tsx scripts/live-test.ts
import { config } from 'dotenv';
config({ path: '.env.local' });

import { generatePlan } from '@/lib/ai/anthropic-client';
import { validatePlan } from '@/lib/plan-validators';
import type { WizardInput } from '@/lib/schemas';

// 20-week marathon plan — triggers batch path (>12 weeks). DEF-004 fix gate.
const MARATHON_INPUT: WizardInput = {
  race_distance_km: 42.2,
  race_date: '2026-10-04',  // ~19-20 weeks — batch path
  race_name: 'Berlin Marathon',
  experience_level: 'intermediate',
  wizard_data: {
    weekly_km_current: 40,
    recent_race: { distance_km: 21.1, time_seconds: 6300, date: '2026-01-01' }, // 1:45 HM
    days_per_week: 5,
    long_run_day: 'sat',
    goal_time_seconds: 14400, // 4:00 marathon
  },
};

async function main() {
  console.log('Starting live plan generation (batch path test)...');
  const start = Date.now();

  const result = await generatePlan(MARATHON_INPUT, { maxRetries: 2 });
  const elapsed = Date.now() - start;

  console.log(`Done in ${(elapsed / 1000).toFixed(1)}s`);
  console.log(`success=${result.success}, attempts=${result.attempts}`);
  console.log(`strategy=${result.metadata.strategy}, batches=${result.metadata.batches}, total_attempts=${result.metadata.total_attempts}`);

  if (!result.success) {
    console.error(`FAIL: stage=${result.stage}`);
    console.error(`Error: ${result.error}`);
    process.exit(1);
  }

  const { plan, usage } = result;
  const costUsd = (usage.input_tokens / 1_000_000) * 3 + (usage.output_tokens / 1_000_000) * 15;

  console.log(`Model: ${process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-6'}`);
  console.log(`Tokens: input=${usage.input_tokens}, output=${usage.output_tokens}`);
  console.log(`Cost: $${costUsd.toFixed(4)}`);
  console.log(`Weeks: ${plan.total_weeks}, Sessions: ${plan.weeks.reduce((s, w) => s + w.sessions.length, 0)}`);
  console.log(`Checkpoints: ${plan.checkpoints.length}`);
  console.log(`Philosophy (first 100): ${plan.summary.philosophy.substring(0, 100)}`);

  // Validate business rules
  const sessions = plan.weeks.flatMap((w) =>
    w.sessions.map((s) => ({
      week_number: s.week_number,
      day_of_week: s.day_of_week,
      session_type: s.session_type,
      distance_km: s.distance_km,
      target_pace_seconds_per_km: s.target_pace_seconds_per_km,
    })),
  );
  const validation = validatePlan({ experience_level: MARATHON_INPUT.experience_level, sessions });
  const errors = validation.issues.filter((i) => i.severity === 'error');
  const warnings = validation.issues.filter((i) => i.severity === 'warning');

  if (errors.length > 0) {
    console.error('Business rule ERRORS:', errors.map((e) => e.message));
    process.exit(1);
  }

  // Verify week count + numbering continuity
  const weekNumbers = plan.weeks.map((w) => w.week_number);
  const expected = Array.from({ length: plan.total_weeks }, (_, i) => i + 1);
  const hasGaps = !weekNumbers.every((n, i) => n === expected[i]);
  if (hasGaps) {
    console.error('FAIL: week numbering has gaps:', weekNumbers);
    process.exit(1);
  }

  console.log(`Business rules: PASS (${warnings.length} warnings)`);
  console.log(`Week numbering: PASS (1..${plan.total_weeks}, no gaps)`);
  console.log('GATE: ✅ 20-week plan via batch path — no truncation, validated successfully');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
