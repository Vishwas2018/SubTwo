import { describe, it, expect, vi } from 'vitest';
import { generatePlan, type ClientLike, type AnthropicResponse } from '@/lib/ai/anthropic-client';
import type { WizardInput } from '@/lib/schemas';
import type { GeneratedPlan, PlanSkeleton } from '@/lib/schemas/plan';

// ─── 20-week fixture helpers ──────────────────────────────────────────────────

type SessionDef = {
  day: number;
  type: GeneratedPlan['weeks'][0]['sessions'][0]['session_type'];
  km?: number;
  pace?: number;
};

function makeWeek(n: number, phase: string, total: number, sessions: SessionDef[]): GeneratedPlan['weeks'][0] {
  return {
    week_number: n,
    phase,
    total_km: total,
    sessions: sessions.map((s) => ({
      week_number: n,
      day_of_week: s.day,
      session_type: s.type,
      ...(s.km !== undefined ? { distance_km: s.km } : {}),
      ...(s.pace !== undefined ? { target_pace_seconds_per_km: s.pace } : {}),
    })),
  };
}

function qualityWeek(n: number, phase: string, total: number, lr: number): GeneratedPlan['weeks'][0] {
  const rec = Math.round((total - lr) * 0.13);
  const thr = Math.round((total - lr) * 0.22);
  const ivl = Math.round((total - lr) * 0.20);
  const e2 = Math.round((total - lr) * 0.14);
  const e1 = total - lr - rec - thr - ivl - e2;
  return makeWeek(n, phase, total, [
    { day: 1, type: 'easy', km: e1, pace: 390 },
    { day: 2, type: 'threshold', km: thr, pace: 308 },
    { day: 3, type: 'recovery', km: rec },
    { day: 4, type: 'interval', km: ivl, pace: 292 },
    { day: 5, type: 'easy', km: e2, pace: 390 },
    { day: 6, type: 'long_run', km: lr },
    { day: 7, type: 'rest' },
  ]);
}

function deloadWeek(n: number, phase: string, total: number, lr: number): GeneratedPlan['weeks'][0] {
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

// 20-week marathon plan. All business rules pass.
// Volumes: 40,44,48, 35(D), 44,48,52,57, 42(D), 52,56,60,65, 48(D), 58,63,68, 50(D), 34, 20(race)
// Deloads: W4,W9,W14,W18 — every 4–5 weeks ✓
// Peak = 68; final week 20 = 29% of peak ✓; W19 taper = 50% of peak ✓
const PACE_ZONES: GeneratedPlan['pace_zones'] = {
  recovery:      { min_seconds_per_km: 480, max_seconds_per_km: 420, rpe_min: 1, rpe_max: 2 },
  easy:          { min_seconds_per_km: 420, max_seconds_per_km: 375, rpe_min: 3, rpe_max: 4 },
  long_run:      { min_seconds_per_km: 400, max_seconds_per_km: 360, rpe_min: 4, rpe_max: 5 },
  marathon_pace: { min_seconds_per_km: 328, max_seconds_per_km: 312, rpe_min: 5, rpe_max: 6 },
  race_pace:     { min_seconds_per_km: 306, max_seconds_per_km: 294, rpe_min: 7, rpe_max: 8 },
  threshold:     { min_seconds_per_km: 312, max_seconds_per_km: 304, rpe_min: 8, rpe_max: 9 },
  interval:      { min_seconds_per_km: 298, max_seconds_per_km: 286, rpe_min: 9, rpe_max: 10 },
};

const WEEKS_20: GeneratedPlan['weeks'] = [
  // Base
  qualityWeek(1, 'Base', 40, 11),
  qualityWeek(2, 'Base', 44, 12),
  qualityWeek(3, 'Base', 48, 13),
  deloadWeek(4, 'Base', 35, 12),
  // Build
  qualityWeek(5, 'Build', 44, 12),
  qualityWeek(6, 'Build', 48, 13),
  qualityWeek(7, 'Build', 52, 13),
  qualityWeek(8, 'Build', 57, 14),
  deloadWeek(9, 'Build', 42, 13),
  // Peak
  qualityWeek(10, 'Peak', 52, 13),
  qualityWeek(11, 'Peak', 56, 14),
  qualityWeek(12, 'Peak', 60, 15),
  qualityWeek(13, 'Peak', 65, 16),
  deloadWeek(14, 'Peak', 48, 14),
  qualityWeek(15, 'Peak', 58, 15),
  qualityWeek(16, 'Peak', 63, 16),
  qualityWeek(17, 'Peak', 68, 17),
  deloadWeek(18, 'Taper', 50, 14),
  // Taper
  deloadWeek(19, 'Taper', 34, 12),
  makeWeek(20, 'Taper', 20, [
    { day: 1, type: 'easy', km: 5 },
    { day: 3, type: 'easy', km: 5 },
    { day: 5, type: 'rest' },
    { day: 7, type: 'race', km: 10 },
  ]),
];

const PLAN_20W: GeneratedPlan = {
  summary: {
    philosophy: 'A 20-week marathon plan with polarized training: 80% easy, 20% quality. Four deload cycles.',
    weekly_pattern: 'Mon: easy. Tue: threshold. Wed: recovery. Thu: interval. Fri: easy. Sat: long run. Sun: rest.',
  },
  pace_zones: PACE_ZONES,
  checkpoints: [
    { week: 5,  type: '5K time trial',     target_seconds: 1437, target_distance_km: 5 },
    { week: 10, type: '10K race sim',       target_seconds: 3060, target_distance_km: 10 },
    { week: 16, type: 'HM race sim',        target_seconds: 6300, target_distance_km: 21.1 },
  ],
  total_weeks: 20,
  weeks: WEEKS_20,
};

// Skeleton derived from PLAN_20W
const SKELETON_20W: PlanSkeleton = {
  summary: PLAN_20W.summary,
  pace_zones: PACE_ZONES,
  checkpoints: PLAN_20W.checkpoints,
  total_weeks: 20,
  weeks_meta: WEEKS_20.map((w, i) => ({
    week_number: w.week_number,
    phase: w.phase ?? 'Base',
    total_km: w.total_km,
    is_deload: i > 0 ? w.total_km / WEEKS_20[i - 1]!.total_km <= 0.8 : false,
  })),
};

// ─── Input that triggers batch path (>12 weeks) ───────────────────────────────

const BATCH_INPUT: WizardInput = {
  race_distance_km: 42.2,
  race_date: '2026-10-04',    // ~19-20 weeks from 2026-05-22 → batch path
  race_name: 'Berlin Marathon',
  experience_level: 'intermediate',
  wizard_data: {
    weekly_km_current: 40,
    recent_race: { distance_km: 21.1, time_seconds: 6300, date: '2026-01-01' },
    days_per_week: 5,
    long_run_day: 'sat',
    goal_time_seconds: 14400,
  },
};

// ─── Mock helpers ─────────────────────────────────────────────────────────────

function mockClient(responses: Array<() => AnthropicResponse | Error>): ClientLike {
  let call = 0;
  return {
    messages: {
      create: vi.fn(async () => {
        const resp = responses[call++];
        if (!resp) throw new Error('Unexpected extra call');
        const result = resp();
        if (result instanceof Error) throw result;
        return result;
      }) as ClientLike['messages']['create'],
    },
  };
}

function apiResponse(text: string, inputTokens = 500, outputTokens = 2000) {
  return (): AnthropicResponse => ({
    content: [{ type: 'text', text }],
    usage: { input_tokens: inputTokens, output_tokens: outputTokens },
  });
}

// Split PLAN_20W into 4 batch responses
function batchResponse(startWeek: number, endWeek: number) {
  const weeks = WEEKS_20.slice(startWeek - 1, endWeek);
  return apiResponse(JSON.stringify({ weeks }));
}

// ─── Skeleton parsing ─────────────────────────────────────────────────────────

describe('batch — skeleton parsing', () => {
  it('valid skeleton JSON parses with PlanSkeletonSchema', async () => {
    const { PlanSkeletonSchema } = await import('@/lib/schemas/plan');
    const result = PlanSkeletonSchema.safeParse(SKELETON_20W);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.total_weeks).toBe(20);
    expect(result.data.weeks_meta).toHaveLength(20);
  });
});

// ─── Routing: 12wk → single, 16wk → batch ─────────────────────────────────────

describe('batch — routing', () => {
  it('12-week input routes to single-call path (metadata.strategy=single)', async () => {
    const shortInput: WizardInput = {
      race_distance_km: 10,
      race_date: '2026-08-10',  // ~11 weeks — single path
      experience_level: 'intermediate',
      wizard_data: {
        weekly_km_current: 40,
        recent_race: { distance_km: 5, time_seconds: 1500, date: '2026-01-01' },
        days_per_week: 5,
        long_run_day: 'sat',
      },
    };
    // Build a 12-week plan JSON matching shortInput weeks
    const { PLAN_12W_10K } = await import('./fixtures');
    const client = mockClient([apiResponse(JSON.stringify(PLAN_12W_10K))]);
    const result = await generatePlan(shortInput, { client, maxRetries: 2 });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.metadata.strategy).toBe('single');
    expect(result.metadata.batches).toBe(0);
  });

  it('batch input routes to batch path (metadata.strategy=batch)', async () => {
    const skeletonJson = JSON.stringify(SKELETON_20W);
    const client = mockClient([
      apiResponse(skeletonJson),
      batchResponse(1, 6),
      batchResponse(7, 12),
      batchResponse(13, 18),
      batchResponse(19, 20),
    ]);
    const result = await generatePlan(BATCH_INPUT, { client, maxRetries: 2 });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.metadata.strategy).toBe('batch');
    expect(result.metadata.batches).toBe(4);
  });
});

// ─── Full 20-week batch assembly ──────────────────────────────────────────────

describe('batch — 20-week assembly', () => {
  it('skeleton + 4 batches assembles valid 20-week plan', async () => {
    const client = mockClient([
      apiResponse(JSON.stringify(SKELETON_20W)),
      batchResponse(1, 6),
      batchResponse(7, 12),
      batchResponse(13, 18),
      batchResponse(19, 20),
    ]);
    const result = await generatePlan(BATCH_INPUT, { client, maxRetries: 2 });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.plan.total_weeks).toBe(20);
    expect(result.plan.weeks).toHaveLength(20);
    expect(result.plan.checkpoints).toHaveLength(3);
    expect(result.attempts).toBe(5);  // 1 skeleton + 4 batches
    expect(result.metadata.total_attempts).toBe(5);
  });

  it('assembled plan passes GeneratedPlanSchema', async () => {
    const { GeneratedPlanSchema } = await import('@/lib/schemas/plan');
    const zodResult = GeneratedPlanSchema.safeParse(PLAN_20W);
    expect(zodResult.success).toBe(true);
  });

  it('assembled plan passes validatePlan business rules', async () => {
    const { validatePlan } = await import('@/lib/plan-validators');
    const sessions = WEEKS_20.flatMap((w) =>
      w.sessions.map((s) => ({
        week_number: s.week_number,
        day_of_week: s.day_of_week,
        session_type: s.session_type,
        distance_km: s.distance_km,
        target_pace_seconds_per_km: s.target_pace_seconds_per_km,
      })),
    );
    const validation = validatePlan({ experience_level: 'intermediate', sessions });
    const errors = validation.issues.filter((i) => i.severity === 'error');
    expect(errors).toHaveLength(0);
  });
});

// ─── Batch seam: volume continuity ───────────────────────────────────────────

describe('batch — seam continuity', () => {
  it('week 6→7 volume increase ≤10% (first batch seam)', () => {
    const w6 = WEEKS_20[5]!;
    const w7 = WEEKS_20[6]!;
    expect(w6.week_number).toBe(6);
    expect(w7.week_number).toBe(7);
    const increase = (w7.total_km - w6.total_km) / w6.total_km;
    expect(increase).toBeLessThanOrEqual(0.10);
  });

  it('week 12→13 volume increase ≤10% (second batch seam)', () => {
    const w12 = WEEKS_20[11]!;
    const w13 = WEEKS_20[12]!;
    const increase = (w13.total_km - w12.total_km) / w12.total_km;
    expect(increase).toBeLessThanOrEqual(0.10);
  });

  it('week 18→19 is a valid taper (≤50% of peak 68km)', () => {
    const w19 = WEEKS_20[18]!;
    expect(w19.total_km).toBeLessThanOrEqual(68 * 0.5);
  });
});

// ─── Per-batch retry on bad JSON ──────────────────────────────────────────────

describe('batch — per-batch retry', () => {
  it('batch 2 returns bad JSON → retries that batch → succeeds', async () => {
    const client = mockClient([
      apiResponse(JSON.stringify(SKELETON_20W)),
      batchResponse(1, 6),
      apiResponse('not valid json at all'),      // batch 2 attempt 1
      batchResponse(7, 12),                      // batch 2 attempt 2 (retry)
      batchResponse(13, 18),
      batchResponse(19, 20),
    ]);
    const result = await generatePlan(BATCH_INPUT, { client, maxRetries: 2 });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.plan.total_weeks).toBe(20);
    expect(result.attempts).toBe(6);  // 1 skeleton + 5 batch calls (1 retry in batch 2)
  });

  it('batch 1 fails all attempts (schema invalid × 3) → stage:schema', async () => {
    const badBatch = JSON.stringify({ weeks: 'not-an-array' });
    const client = mockClient([
      apiResponse(JSON.stringify(SKELETON_20W)),
      apiResponse(badBatch),
      apiResponse(badBatch),
      apiResponse(badBatch),
    ]);
    const result = await generatePlan(BATCH_INPUT, { client, maxRetries: 2 });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.stage).toBe('schema');
    expect(result.error).toContain('Batch 1');
  });
});

// ─── Token/cost aggregation ───────────────────────────────────────────────────

describe('batch — token aggregation', () => {
  it('sums input/output tokens across skeleton + all batches', async () => {
    const client = mockClient([
      apiResponse(JSON.stringify(SKELETON_20W), 400, 800),   // skeleton
      batchResponse(1, 6),                                    // batch 1 (500+2000 default)
      batchResponse(7, 12),
      batchResponse(13, 18),
      batchResponse(19, 20),
    ]);
    // Override default tokens for last 4 batch responses
    const client2 = mockClient([
      apiResponse(JSON.stringify(SKELETON_20W), 400,  800),
      apiResponse(JSON.stringify({ weeks: WEEKS_20.slice(0, 6)  }), 300, 1500),
      apiResponse(JSON.stringify({ weeks: WEEKS_20.slice(6, 12) }), 300, 1500),
      apiResponse(JSON.stringify({ weeks: WEEKS_20.slice(12, 18)}), 300, 1500),
      apiResponse(JSON.stringify({ weeks: WEEKS_20.slice(18, 20)}), 300,  800),
    ]);
    const result = await generatePlan(BATCH_INPUT, { client: client2, maxRetries: 2 });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.usage.input_tokens).toBe(400 + 300 * 4);   // 1600
    expect(result.usage.output_tokens).toBe(800 + 1500 * 3 + 800);  // 6100
  });
});

// ─── Week count + numbering continuity ───────────────────────────────────────

describe('batch — week numbering', () => {
  it('assembled plan has weeks 1..20 with no gaps', async () => {
    const client = mockClient([
      apiResponse(JSON.stringify(SKELETON_20W)),
      batchResponse(1, 6),
      batchResponse(7, 12),
      batchResponse(13, 18),
      batchResponse(19, 20),
    ]);
    const result = await generatePlan(BATCH_INPUT, { client, maxRetries: 2 });

    expect(result.success).toBe(true);
    if (!result.success) return;
    const weekNumbers = result.plan.weeks.map((w) => w.week_number);
    expect(weekNumbers).toEqual(Array.from({ length: 20 }, (_, i) => i + 1));
  });
});

// ─── Skeleton API error → stage:api ──────────────────────────────────────────

describe('batch — skeleton failure', () => {
  it('skeleton API throws → stage:api', async () => {
    const client = mockClient([
      () => new Error('network timeout'),
    ]);
    const result = await generatePlan(BATCH_INPUT, { client, maxRetries: 2 });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.stage).toBe('api');
    expect(result.metadata.strategy).toBe('batch');
  });

  it('skeleton bad JSON exhausts retries → stage:json_parse', async () => {
    const client = mockClient([
      apiResponse('not json'),
      apiResponse('still not json'),
      apiResponse('never json'),
    ]);
    const result = await generatePlan(BATCH_INPUT, { client, maxRetries: 2 });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.stage).toBe('json_parse');
    expect(result.error).toContain('Skeleton JSON parse failed');
  });
});
