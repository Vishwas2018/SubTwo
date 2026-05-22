import { describe, it, expect, vi } from 'vitest';
import { generatePlan, extractJson, type ClientLike, type AnthropicResponse } from '@/lib/ai/anthropic-client';
import type { WizardInput } from '@/lib/schemas';
import { PLAN_12W_10K, planWithVolumeJump } from './fixtures';

// ─── Shared wizard input ──────────────────────────────────────────────────────

// race_date ≤12 weeks from 2026-05-22 → routes through single-call path
const SAMPLE_INPUT: WizardInput = {
  race_distance_km: 10,
  race_date: '2026-08-10',
  experience_level: 'intermediate',
  wizard_data: {
    weekly_km_current: 40,
    recent_race: { distance_km: 5, time_seconds: 1500, date: '2026-01-01' },
    days_per_week: 5,
    long_run_day: 'sat',
  },
};

// ─── Mock client factory ──────────────────────────────────────────────────────

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

const VALID_JSON = JSON.stringify(PLAN_12W_10K);

// ─── extractJson ──────────────────────────────────────────────────────────────

describe('extractJson', () => {
  it('parses plain JSON', () => {
    expect(extractJson('{"a":1}')).toEqual({ a: 1 });
  });

  it('strips ```json fences', () => {
    expect(extractJson('```json\n{"a":1}\n```')).toEqual({ a: 1 });
  });

  it('strips ``` fences without language', () => {
    expect(extractJson('```\n{"a":1}\n```')).toEqual({ a: 1 });
  });

  it('extracts JSON from surrounding text (no fence)', () => {
    expect(extractJson('Here is your plan: {"a":1} done.')).toEqual({ a: 1 });
  });

  it('throws when no JSON object found', () => {
    expect(() => extractJson('no json here')).toThrow('No JSON object found');
  });

  it('throws on malformed JSON', () => {
    expect(() => extractJson('{"a": invalid}')).toThrow('Failed to parse JSON');
  });
});

// ─── generatePlan happy path ──────────────────────────────────────────────────

describe('generatePlan — happy path', () => {
  it('returns success:true with parsed plan on first attempt', async () => {
    const client = mockClient([apiResponse(VALID_JSON)]);
    const result = await generatePlan(SAMPLE_INPUT, { client, maxRetries: 2 });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.plan.total_weeks).toBe(12);
    expect(result.plan.weeks).toHaveLength(12);
    expect(result.attempts).toBe(1);
    expect(result.usage.input_tokens).toBe(500);
    expect(result.usage.output_tokens).toBe(2000);
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('recovers code-fence wrapped JSON on first attempt', async () => {
    const fenced = '```json\n' + VALID_JSON + '\n```';
    const client = mockClient([apiResponse(fenced)]);
    const result = await generatePlan(SAMPLE_INPUT, { client, maxRetries: 2 });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.plan.total_weeks).toBe(12);
    expect(result.attempts).toBe(1);
  });
});

// ─── generatePlan retry logic ─────────────────────────────────────────────────

describe('generatePlan — retry logic', () => {
  it('invalid JSON first attempt, valid on retry → success, attempts=2', async () => {
    const client = mockClient([
      apiResponse('not valid json at all'),
      apiResponse(VALID_JSON),
    ]);
    const result = await generatePlan(SAMPLE_INPUT, { client, maxRetries: 2 });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.attempts).toBe(2);
  });

  it('schema failure exhausts maxRetries → stage:schema', async () => {
    const noWeeks = JSON.stringify({ ...PLAN_12W_10K, weeks: undefined, total_weeks: 0 });
    const client = mockClient([
      apiResponse(noWeeks),
      apiResponse(noWeeks),
      apiResponse(noWeeks),
    ]);
    const result = await generatePlan(SAMPLE_INPUT, { client, maxRetries: 2 });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.stage).toBe('schema');
    expect(result.attempts).toBe(3);
  });

  it('business rule failure exhausts maxRetries → stage:business_rules', async () => {
    const badPlan = JSON.stringify(planWithVolumeJump());
    const client = mockClient([
      apiResponse(badPlan),
      apiResponse(badPlan),
      apiResponse(badPlan),
    ]);
    const result = await generatePlan(SAMPLE_INPUT, { client, maxRetries: 2 });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.stage).toBe('business_rules');
    expect(result.error).toContain('volume');
  });

  it('schema failure then valid → success, attempts=2', async () => {
    const noWeeks = JSON.stringify({ ...PLAN_12W_10K, weeks: undefined, total_weeks: 0 });
    const client = mockClient([
      apiResponse(noWeeks),
      apiResponse(VALID_JSON),
    ]);
    const result = await generatePlan(SAMPLE_INPUT, { client, maxRetries: 2 });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.attempts).toBe(2);
  });

  it('json parse failure exhausts maxRetries=1 → stage:json_parse', async () => {
    const client = mockClient([
      apiResponse('garbage'),
      apiResponse('still garbage'),
    ]);
    const result = await generatePlan(SAMPLE_INPUT, { client, maxRetries: 1 });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.stage).toBe('json_parse');
    expect(result.attempts).toBe(2);
  });
});

// ─── API error ────────────────────────────────────────────────────────────────

describe('generatePlan — API errors', () => {
  it('API throws → stage:api, returns immediately without retry', async () => {
    const client = mockClient([
      () => new Error('network timeout'),
    ]);
    const result = await generatePlan(SAMPLE_INPUT, { client, maxRetries: 2 });

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.stage).toBe('api');
    expect(result.error).toContain('network timeout');
    expect(result.attempts).toBe(1);
    expect(client.messages.create).toHaveBeenCalledTimes(1);
  });
});

// ─── Usage accumulation ───────────────────────────────────────────────────────

describe('generatePlan — usage accumulation', () => {
  it('accumulates input/output tokens across retries', async () => {
    const noWeeks = JSON.stringify({ ...PLAN_12W_10K, weeks: undefined, total_weeks: 0 });
    const client = mockClient([
      apiResponse(noWeeks, 400, 800),
      apiResponse(VALID_JSON, 600, 1500),
    ]);
    const result = await generatePlan(SAMPLE_INPUT, { client, maxRetries: 2 });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.usage.input_tokens).toBe(1000);   // 400 + 600
    expect(result.usage.output_tokens).toBe(2300);  // 800 + 1500
  });
});

// ─── model/key options ────────────────────────────────────────────────────────

describe('generatePlan — options', () => {
  it('passes model to messages.create', async () => {
    const client = mockClient([apiResponse(VALID_JSON)]);
    await generatePlan(SAMPLE_INPUT, { client, model: 'claude-opus-4-7' });

    expect(client.messages.create).toHaveBeenCalledWith(
      expect.objectContaining({ model: 'claude-opus-4-7' }),
    );
  });

  it('defaults maxRetries to 2 (allows up to 3 attempts)', async () => {
    const noWeeks = JSON.stringify({ ...PLAN_12W_10K, weeks: undefined, total_weeks: 0 });
    const client = mockClient([
      apiResponse(noWeeks),
      apiResponse(noWeeks),
      apiResponse(VALID_JSON),
    ]);
    const result = await generatePlan(SAMPLE_INPUT, { client });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.attempts).toBe(3);
  });
});
