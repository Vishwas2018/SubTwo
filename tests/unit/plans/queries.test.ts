// Unit tests for lib/plans/queries.ts (mocked Supabase)
// Refs: P2-07, P2-08
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mock queue ───────────────────────────────────────────────────────────────
// Each awaitable DB call (single / maybeSingle / direct await) pulls from this queue.

type DbResult = { data: unknown; error: { message: string } | null };
const callQueue: DbResult[] = [];

function enq(data: unknown, error: { message: string } | null = null) {
  callQueue.push({ data, error });
}

function deq(): DbResult {
  return callQueue.shift() ?? { data: null, error: { message: 'unexpected extra call' } };
}

// Builder is both chainable and thenable so direct-await queries work too.
const builder: Record<string, unknown> = {
  select: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  is: vi.fn().mockReturnThis(),
  order: vi.fn().mockReturnThis(),
  single: vi.fn().mockImplementation(() => Promise.resolve(deq())),
  maybeSingle: vi.fn().mockImplementation(() => Promise.resolve(deq())),
  then: (resolve: (v: DbResult) => unknown) => Promise.resolve(deq()).then(resolve),
};

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({ from: vi.fn().mockReturnValue(builder) }),
}));

// ─── Import after mock ────────────────────────────────────────────────────────
import { getActivePlan, getSessionById } from '@/lib/plans/queries';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const PLAN = {
  id: 'plan-1',
  user_id: 'user-1',
  status: 'active',
  current_version_id: 'ver-1',
  race_distance_km: 21.1,
  race_name: 'Test HM',
  race_date: '2026-09-14',
  start_date: '2026-06-01',
  total_weeks: 16,
  experience_level: 'intermediate',
  goal_time_seconds: 7199,
  pace_zones: {},
  activated_at: null,
  completed_at: null,
  created_at: '2026-01-01T00:00:00Z',
  baseline_data: {},
};

const SESSION = {
  id: 'sess-1',
  plan_id: 'plan-1',
  plan_version_id: 'ver-1',
  week_number: 1,
  day_of_week: 2,
  phase: 'base',
  session_type: 'easy',
  distance_km: 8,
  scheduled_date: '2026-06-02',
  target_pace_min: null,
  target_pace_max: null,
  focus: null,
  structure: null,
  notes: null,
  is_checkpoint: false,
  is_deload: false,
  checkpoint_type: null,
  created_at: '2026-01-01T00:00:00Z',
};

const RUN = {
  id: 'run-1',
  user_id: 'user-1',
  planned_session_id: 'sess-1',
  run_date: '2026-06-02',
  distance_km: 8,
  duration_seconds: 2880,
  source: 'manual',
  avg_pace_seconds: 360,
  avg_hr: null,
  max_hr: null,
  avg_cadence: null,
  elevation_gain_m: null,
  rpe: null,
  felt_easy: null,
  stitch_occurred: false,
  stitch_severity: null,
  shoes: null,
  notes: null,
  external_id: null,
  raw_data: null,
  weather: null,
  start_time: null,
  deleted_at: null,
  created_at: '2026-06-02T10:00:00Z',
};

// ─── getActivePlan ────────────────────────────────────────────────────────────

describe('getActivePlan', () => {
  beforeEach(() => {
    callQueue.length = 0;
    vi.mocked(builder.single as ReturnType<typeof vi.fn>).mockImplementation(() =>
      Promise.resolve(deq()),
    );
    vi.mocked(builder.maybeSingle as ReturnType<typeof vi.fn>).mockImplementation(() =>
      Promise.resolve(deq()),
    );
  });

  it('returns null when plan query returns error', async () => {
    enq(null, { message: 'no rows' }); // plans.single()
    const result = await getActivePlan('user-1');
    expect(result).toBeNull();
  });

  it('returns null when plan data is null', async () => {
    enq(null); // plans.single() — no error, but no data
    const result = await getActivePlan('user-1');
    expect(result).toBeNull();
  });

  it('returns plan with empty sessions when no current_version_id', async () => {
    enq({ ...PLAN, current_version_id: null }); // plans.single()
    const result = await getActivePlan('user-1');
    expect(result).not.toBeNull();
    expect(result?.sessions).toEqual([]);
  });

  it('returns plan with sessions on happy path', async () => {
    enq(PLAN); // plans.single()
    enq([SESSION]); // planned_sessions direct-await
    const result = await getActivePlan('user-1');
    expect(result?.id).toBe('plan-1');
    expect(result?.sessions).toHaveLength(1);
  });

  it('returns empty sessions when sessions query errors', async () => {
    enq(PLAN); // plans.single()
    enq(null, { message: 'sessions error' }); // planned_sessions direct-await error
    const result = await getActivePlan('user-1');
    expect(result?.sessions).toEqual([]);
  });

  it('returns empty sessions when sessions data is null', async () => {
    enq(PLAN); // plans.single()
    enq(null); // planned_sessions — null data, no error
    const result = await getActivePlan('user-1');
    expect(result?.sessions).toEqual([]);
  });
});

// ─── getSessionById ───────────────────────────────────────────────────────────

describe('getSessionById', () => {
  beforeEach(() => {
    callQueue.length = 0;
    vi.mocked(builder.single as ReturnType<typeof vi.fn>).mockImplementation(() =>
      Promise.resolve(deq()),
    );
    vi.mocked(builder.maybeSingle as ReturnType<typeof vi.fn>).mockImplementation(() =>
      Promise.resolve(deq()),
    );
  });

  it('returns null when session not found', async () => {
    enq(null, { message: 'not found' }); // planned_sessions.single()
    const result = await getSessionById('bad-id', 'user-1');
    expect(result).toBeNull();
  });

  it('returns null when session data is null', async () => {
    enq(null); // planned_sessions.single()
    const result = await getSessionById('sess-1', 'user-1');
    expect(result).toBeNull();
  });

  it('returns null when plan not found', async () => {
    enq(SESSION); // planned_sessions.single()
    enq(null, { message: 'plan not found' }); // plans.single()
    const result = await getSessionById('sess-1', 'user-1');
    expect(result).toBeNull();
  });

  it('returns null when plan data is null', async () => {
    enq(SESSION); // planned_sessions.single()
    enq(null); // plans.single()
    const result = await getSessionById('sess-1', 'user-1');
    expect(result).toBeNull();
  });

  it('returns null when plan user_id does not match (ownership check)', async () => {
    enq(SESSION); // planned_sessions.single()
    enq({ ...PLAN, user_id: 'other-user', user_id_field: 'other-user' }); // plans.single()
    const result = await getSessionById('sess-1', 'user-1');
    expect(result).toBeNull();
  });

  it('returns session detail with linked run on happy path', async () => {
    enq(SESSION); // planned_sessions.single()
    enq({
      id: 'plan-1',
      user_id: 'user-1',
      race_name: 'Test HM',
      race_date: '2026-09-14',
      race_distance_km: 21.1,
      total_weeks: 16,
      goal_time_seconds: 7199,
      pace_zones: {},
    }); // plans.single()
    enq(RUN); // runs.maybeSingle()
    const result = await getSessionById('sess-1', 'user-1');
    expect(result?.session.id).toBe('sess-1');
    expect(result?.linkedRun?.id).toBe('run-1');
  });

  it('returns session detail with null linkedRun when no run', async () => {
    enq(SESSION);
    enq({
      id: 'plan-1',
      user_id: 'user-1',
      race_name: null,
      race_date: '2026-09-14',
      race_distance_km: 21.1,
      total_weeks: 16,
      goal_time_seconds: null,
      pace_zones: {},
    });
    enq(null); // runs.maybeSingle() → null
    const result = await getSessionById('sess-1', 'user-1');
    expect(result?.linkedRun).toBeNull();
    expect(result?.plan.race_name).toBeNull();
  });
});
