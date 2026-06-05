// Quick Qwen smoke test — 8-week plan, single-call path.
// Run: NODE_OPTIONS=--use-system-ca pnpm tsx scripts/qwen-smoke.ts
import { config } from 'dotenv';
config({ path: '.env.local' });

import { qwenProvider } from '@/lib/ai/providers/qwen';
import { validatePlan } from '@/lib/plan-validators';
import type { WizardInput } from '@/lib/schemas';

const INPUT: WizardInput = {
  race_distance_km: 42.2,
  race_date: '2026-07-26', // ~7–8 weeks — single-call path
  race_name: 'Test Marathon',
  experience_level: 'intermediate',
  wizard_data: {
    weekly_km_current: 35,
    recent_race: { distance_km: 10, time_seconds: 3000, date: '2026-04-01' }, // 50-min 10k
    days_per_week: 4,
    long_run_day: 'sun',
  },
};

async function main() {
  console.log('Qwen smoke test — 8-week plan...');
  const start = Date.now();
  const result = await qwenProvider.generatePlan(INPUT, { timeout: 45_000 });
  const elapsed = ((Date.now() - start) / 1000).toFixed(1);

  console.log(`Done in ${elapsed}s`);
  console.log(`success=${result.success}, attempts=${result.attempts}`);

  if (!result.success) {
    console.error(`FAIL: stage=${result.stage}`);
    console.error(`Error: ${result.error}`);
    process.exit(1);
  }

  const { plan, usage } = result;
  console.log(`Weeks: ${plan.total_weeks}, Sessions: ${plan.weeks.reduce((s, w) => s + w.sessions.length, 0)}`);
  console.log(`Tokens: in=${usage.input_tokens}, out=${usage.output_tokens}`);

  const sessions = plan.weeks.flatMap((w) =>
    w.sessions.map((s) => ({
      week_number: s.week_number,
      day_of_week: s.day_of_week,
      session_type: s.session_type,
      distance_km: s.distance_km,
      target_pace_seconds_per_km: s.target_pace_seconds_per_km,
    })),
  );
  const validation = validatePlan({ experience_level: INPUT.experience_level, sessions });
  // Generate route does NOT gate on business rules for Qwen — report as info only.
  const errors = validation.issues.filter((i) => i.severity === 'error');
  if (errors.length > 0) {
    console.warn('Business rule warnings (not gated in prod):', errors.map((e) => e.message));
  } else {
    console.log(`Business rules: PASS`);
  }
  console.log('SMOKE: ✅ Qwen plan — JSON+schema valid, route would return 201');
}

main().catch((err) => { console.error(err); process.exit(1); });
