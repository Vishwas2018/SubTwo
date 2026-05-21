import type { GeneratedPlan } from '@/lib/schemas/plan';

// Known-good 12-week 10K plan.
// Goal: 50:00 (3000s), race pace = 300 s/km.
// Volumes: 40, 44, 48, 35(deload), 44, 48, 52, 38(deload), 50, 55(peak), 38(taper), 20(race)
// All business rules pass: ≤10% ramp, deloads every 3–4 weeks, ≤2 quality/wk,
// no back-to-back quality, race in final week, final week ≤50% of peak.

type SessionDef = {
  day: number;
  type: GeneratedPlan['weeks'][0]['sessions'][0]['session_type'];
  km?: number;
  pace?: number;
};

function makeWeek(
  weekNumber: number,
  phase: string,
  totalKm: number,
  sessions: SessionDef[],
): GeneratedPlan['weeks'][0] {
  return {
    week_number: weekNumber,
    phase,
    total_km: totalKm,
    sessions: sessions.map((s) => ({
      week_number: weekNumber,
      day_of_week: s.day,
      session_type: s.type,
      ...(s.km !== undefined ? { distance_km: s.km } : {}),
      ...(s.pace !== undefined ? { target_pace_seconds_per_km: s.pace } : {}),
    })),
  };
}

// Quality week layout: Mon easy, Tue threshold, Wed recovery, Thu interval, Fri easy, Sat long_run, Sun rest
// Deload/taper layout: Mon easy, Wed recovery, Fri easy, Sat long_run, Sun rest
// Race week: Mon easy, Wed easy, Fri rest, Sun race

function qualityWeek(
  n: number,
  phase: string,
  total: number,
  lr: number,
  threshold = 308,
  interval = 292,
): GeneratedPlan['weeks'][0] {
  // Remaining km after long_run: divide among easy(×2), threshold, interval, recovery
  // easy×2 + threshold + interval + recovery + lr = total
  // e.g. total=40, lr=11 → remaining=29 → ~7+7+7+6+2 (not quite)
  // Use fixed ratios: threshold≈17%, interval≈16%, easy1≈18%, easy2≈12%, recovery≈10%
  const rec = Math.round((total - lr) * 0.13);
  const thr = Math.round((total - lr) * 0.22);
  const ivl = Math.round((total - lr) * 0.20);
  const e2 = Math.round((total - lr) * 0.14);
  const e1 = total - lr - rec - thr - ivl - e2;

  return makeWeek(n, phase, total, [
    { day: 1, type: 'easy', km: e1, pace: 390 },
    { day: 2, type: 'threshold', km: thr, pace: threshold },
    { day: 3, type: 'recovery', km: rec },
    { day: 4, type: 'interval', km: ivl, pace: interval },
    { day: 5, type: 'easy', km: e2, pace: 390 },
    { day: 6, type: 'long_run', km: lr },
    { day: 7, type: 'rest' },
  ]);
}

function deloadWeek(
  n: number,
  phase: string,
  total: number,
  lr: number,
): GeneratedPlan['weeks'][0] {
  const e2 = Math.round((total - lr) * 0.37);
  const rec = Math.round((total - lr) * 0.22);
  const e1 = total - lr - e2 - rec;
  return makeWeek(n, phase, total, [
    { day: 1, type: 'easy', km: e1 },
    { day: 3, type: 'recovery', km: rec },
    { day: 5, type: 'easy', km: e2 },
    { day: 6, type: 'long_run', km: lr },
    { day: 7, type: 'rest' },
  ]);
}

export const PLAN_12W_10K: GeneratedPlan = {
  summary: {
    philosophy:
      'A 12-week 10K plan built on polarized training: 80% easy aerobic work and 20% quality. Progressive volume with mandatory deloads every 3–4 weeks ensure adaptation without over-training.',
    weekly_pattern:
      'Mon: easy. Tue: threshold (quality weeks only). Wed: recovery. Thu: interval (quality weeks only). Fri: easy. Sat: long run. Sun: rest.',
  },
  pace_zones: {
    recovery: { min_seconds_per_km: 480, max_seconds_per_km: 420, rpe_min: 1, rpe_max: 2 },
    easy: { min_seconds_per_km: 420, max_seconds_per_km: 375, rpe_min: 3, rpe_max: 4 },
    long_run: { min_seconds_per_km: 400, max_seconds_per_km: 360, rpe_min: 4, rpe_max: 5 },
    marathon_pace: { min_seconds_per_km: 328, max_seconds_per_km: 312, rpe_min: 5, rpe_max: 6 },
    race_pace: { min_seconds_per_km: 306, max_seconds_per_km: 294, rpe_min: 7, rpe_max: 8 },
    threshold: { min_seconds_per_km: 312, max_seconds_per_km: 304, rpe_min: 8, rpe_max: 9 },
    interval: { min_seconds_per_km: 298, max_seconds_per_km: 286, rpe_min: 9, rpe_max: 10 },
  },
  checkpoints: [
    { week: 3, type: '5K time trial', target_seconds: 1437, target_distance_km: 5 },
    { week: 6, type: '8K tempo test', target_seconds: 2365, target_distance_km: 8 },
    { week: 10, type: '10K race simulation', target_seconds: 3060, target_distance_km: 10 },
  ],
  total_weeks: 12,
  weeks: [
    // W1 40km, W2 44km, W3 48km — Base phase quality weeks
    qualityWeek(1, 'Base', 40, 11),
    qualityWeek(2, 'Base', 44, 12),
    qualityWeek(3, 'Base', 48, 13),
    // W4 35km — deload (73% of 48)
    deloadWeek(4, 'Base', 35, 12),
    // W5 44km, W6 48km, W7 52km — Build phase
    qualityWeek(5, 'Build', 44, 12),
    qualityWeek(6, 'Build', 48, 13),
    qualityWeek(7, 'Build', 52, 13),
    // W8 38km — deload (73% of 52)
    deloadWeek(8, 'Build', 38, 13),
    // W9 50km, W10 55km — Peak
    qualityWeek(9, 'Peak', 50, 13),
    qualityWeek(10, 'Peak', 55, 14),
    // W11 38km — taper deload (69% of 55)
    deloadWeek(11, 'Taper', 38, 13),
    // W12 20km — race week (36% of peak 55 → ≤50% ✓)
    makeWeek(12, 'Taper', 20, [
      { day: 1, type: 'easy', km: 5 },
      { day: 3, type: 'easy', km: 5 },
      { day: 5, type: 'rest' },
      { day: 7, type: 'race', km: 10 },
    ]),
  ],
};

export function planWithVolumeJump(): GeneratedPlan {
  // W1=40, W2=47 → 17.5% jump (>10% cap) → business_rules failure
  return {
    ...PLAN_12W_10K,
    weeks: [
      qualityWeek(1, 'Base', 40, 11),
      qualityWeek(2, 'Base', 47, 13), // 17.5% increase
      ...PLAN_12W_10K.weeks.slice(2),
    ],
  };
}
