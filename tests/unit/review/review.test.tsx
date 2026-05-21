// RTL tests for the /onboarding/review screen.
// Refs: P2-06
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { ReviewContent } from '@/app/onboarding/review/review-content';
import type { GeneratedPlan } from '@/lib/schemas/plan';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams('plan=test-plan-id'),
  usePathname: () => '/onboarding/review',
}));

// ─── Fixture ──────────────────────────────────────────────────────────────────

const GENERATED_PLAN: GeneratedPlan = {
  summary: {
    philosophy: 'Build aerobic base before adding quality.',
    weekly_pattern: 'Monday easy · Wednesday threshold · Saturday long run.',
  },
  pace_zones: {
    recovery: { min_seconds_per_km: 420, max_seconds_per_km: 390, rpe_min: 1, rpe_max: 2 },
    easy: { min_seconds_per_km: 390, max_seconds_per_km: 360, rpe_min: 2, rpe_max: 3 },
    long_run: { min_seconds_per_km: 375, max_seconds_per_km: 345, rpe_min: 3, rpe_max: 4 },
    marathon_pace: { min_seconds_per_km: 355, max_seconds_per_km: 335, rpe_min: 4, rpe_max: 5 },
    race_pace: { min_seconds_per_km: 335, max_seconds_per_km: 315, rpe_min: 5, rpe_max: 6 },
    threshold: { min_seconds_per_km: 315, max_seconds_per_km: 295, rpe_min: 7, rpe_max: 8 },
    interval: { min_seconds_per_km: 290, max_seconds_per_km: 270, rpe_min: 9, rpe_max: 10 },
  },
  checkpoints: [
    { week: 8, type: 'time_trial', target_seconds: 2700, target_distance_km: 10 },
    { week: 16, type: 'time_trial', target_seconds: 5400, target_distance_km: 21.1 },
  ],
  weeks: [
    {
      week_number: 1,
      phase: 'base',
      total_km: 40,
      sessions: [
        { week_number: 1, day_of_week: 1, session_type: 'easy', distance_km: 8, target_pace_seconds_per_km: 375 },
        { week_number: 1, day_of_week: 3, session_type: 'threshold', distance_km: 10, target_pace_seconds_per_km: 310 },
        { week_number: 1, day_of_week: 6, session_type: 'long_run', distance_km: 18, target_pace_seconds_per_km: 370 },
      ],
    },
    {
      week_number: 2,
      phase: 'build',
      total_km: 44,
      sessions: [
        { week_number: 2, day_of_week: 1, session_type: 'easy', distance_km: 8 },
        { week_number: 2, day_of_week: 6, session_type: 'long_run', distance_km: 20 },
      ],
    },
  ],
  total_weeks: 2,
};

const PLAN_RESPONSE = {
  data: {
    id: 'test-plan-id',
    status: 'draft',
    race_distance_km: 21.1,
    race_name: 'Test Half',
    race_date: '2027-06-01',
    start_date: '2027-01-01',
    total_weeks: 20,
    experience_level: 'intermediate',
    goal_time_seconds: 7199,
    version_id: 'v-1',
    version_number: 1,
    generated_plan: GENERATED_PLAN,
    quota: { allowed: true, lifetime_remaining: 9, daily_remaining: 2 },
  },
};

// ─── Helper ───────────────────────────────────────────────────────────────────

function mockFetchWith(planRes: unknown, activateOk = true) {
  return vi.fn((url: string, opts?: RequestInit) => {
    if (typeof url === 'string' && url.includes('/regenerate')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ data: { plan_id: 'test-plan-id', version_id: 'v-2', version_number: 2 } }),
      });
    }
    if (typeof url === 'string' && url.includes('/activate') && opts?.method === 'POST') {
      return Promise.resolve({
        ok: activateOk,
        json: () =>
          activateOk
            ? Promise.resolve({ data: { plan_id: 'test-plan-id', status: 'active' } })
            : Promise.resolve({ error: { message: 'Activation failed.' } }),
      });
    }
    // Default: plan fetch
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve(planRes),
    });
  });
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('ReviewContent', () => {
  beforeEach(() => {
    mockPush.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('shows loading spinner initially', () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => new Promise(() => {})), // never resolves
    );
    render(<ReviewContent />);
    expect(screen.getByText(/loading your plan/i)).toBeInTheDocument();
  });

  it('renders plan header with race info and goal', async () => {
    vi.stubGlobal('fetch', mockFetchWith(PLAN_RESPONSE));
    render(<ReviewContent />);
    await waitFor(() => expect(screen.getByText(/your training plan/i)).toBeInTheDocument());

    expect(screen.getByText(/Half Marathon/)).toBeInTheDocument();
    expect(screen.getByText(/Test Half/)).toBeInTheDocument();
    expect(screen.getByText(/2027-06-01/)).toBeInTheDocument();
    // Goal: 7199s = 1:59:59
    expect(screen.getByText(/1:59:59/)).toBeInTheDocument();
  });

  it('renders coaching philosophy text', async () => {
    vi.stubGlobal('fetch', mockFetchWith(PLAN_RESPONSE));
    render(<ReviewContent />);
    await waitFor(() =>
      expect(screen.getByText(/Build aerobic base/i)).toBeInTheDocument(),
    );
  });

  it('renders pace zones table with formatted paces', async () => {
    vi.stubGlobal('fetch', mockFetchWith(PLAN_RESPONSE));
    render(<ReviewContent />);
    await waitFor(() => expect(screen.getByText('Pace zones')).toBeInTheDocument());

    // 6:30 /km appears for both recovery max and easy min — multiple is expected
    expect(screen.getAllByText('6:30 /km').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('6:00 /km').length).toBeGreaterThanOrEqual(1);
    // Threshold label appears in zones table
    expect(screen.getAllByText('Threshold').length).toBeGreaterThanOrEqual(1);
  });

  it('renders checkpoints with week, type and target time', async () => {
    vi.stubGlobal('fetch', mockFetchWith(PLAN_RESPONSE));
    render(<ReviewContent />);
    await waitFor(() => expect(screen.getByText('Checkpoints')).toBeInTheDocument());

    expect(screen.getByText(/Week 8/)).toBeInTheDocument();
    // "time trial" may appear multiple times (checkpoint list + full plan) — check at least one
    expect(screen.getAllByText(/time trial/i).length).toBeGreaterThanOrEqual(1);
    // 2700s = 0:45:00
    expect(screen.getAllByText(/0:45:00/).length).toBeGreaterThanOrEqual(1);
  });

  it('renders volume bars for each week', async () => {
    vi.stubGlobal('fetch', mockFetchWith(PLAN_RESPONSE));
    render(<ReviewContent />);
    await waitFor(() => expect(screen.getByText(/Weekly volume/i)).toBeInTheDocument());

    // week 1 (40km) and week 2 (44km) labels
    expect(screen.getByText('W1')).toBeInTheDocument();
    expect(screen.getByText('W2')).toBeInTheDocument();
    expect(screen.getByText('40 km')).toBeInTheDocument();
    expect(screen.getByText('44 km')).toBeInTheDocument();
  });

  it('shows full plan table when "Preview full plan" is clicked', async () => {
    vi.stubGlobal('fetch', mockFetchWith(PLAN_RESPONSE));
    render(<ReviewContent />);
    await waitFor(() => screen.getByText(/Preview full plan/i));
    await userEvent.click(screen.getByText(/Preview full plan/i));

    // After expand: Long Run and Threshold appear in both zones table and plan table
    expect(screen.getAllByText('Long Run').length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText('Threshold').length).toBeGreaterThanOrEqual(2);
  });

  it('Accept & Start calls activate and redirects to /dashboard', async () => {
    vi.stubGlobal('fetch', mockFetchWith(PLAN_RESPONSE, true));
    render(<ReviewContent />);
    await waitFor(() => screen.getByRole('button', { name: /accept.*start/i }));
    await userEvent.click(screen.getByRole('button', { name: /accept.*start/i }));
    await waitFor(() => expect(mockPush).toHaveBeenCalledWith('/dashboard'));
  });

  it('shows error if activate fails', async () => {
    vi.stubGlobal('fetch', mockFetchWith(PLAN_RESPONSE, false));
    render(<ReviewContent />);
    await waitFor(() => screen.getByRole('button', { name: /accept.*start/i }));
    await userEvent.click(screen.getByRole('button', { name: /accept.*start/i }));
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(/activation failed/i),
    );
  });

  it('opens regenerate modal when Regenerate is clicked', async () => {
    vi.stubGlobal('fetch', mockFetchWith(PLAN_RESPONSE));
    render(<ReviewContent />);
    await waitFor(() => screen.getByRole('button', { name: /regenerate plan/i }));
    await userEvent.click(screen.getByRole('button', { name: /regenerate plan/i }));
    expect(screen.getByRole('dialog', { name: /regenerate plan/i })).toBeInTheDocument();
    // Shows quota info
    expect(screen.getByText(/Daily remaining/)).toBeInTheDocument();
    expect(screen.getByText(/Lifetime remaining/)).toBeInTheDocument();
  });

  it('disables Regenerate button when quota is exhausted', async () => {
    const noQuota = { ...PLAN_RESPONSE, data: { ...PLAN_RESPONSE.data, quota: { allowed: false, lifetime_remaining: 0, daily_remaining: 0 } } };
    vi.stubGlobal('fetch', mockFetchWith(noQuota));
    render(<ReviewContent />);
    await waitFor(() => screen.getByRole('button', { name: /regenerate plan/i }));
    expect(screen.getByRole('button', { name: /regenerate plan/i })).toBeDisabled();
    expect(screen.getByText(/quota exhausted/i)).toBeInTheDocument();
  });

  it('shows error message on load failure', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve({ ok: false, json: () => Promise.resolve({ error: { message: 'Not found.' } }) })),
    );
    render(<ReviewContent />);
    await waitFor(() => expect(screen.getByText('Not found.')).toBeInTheDocument());
  });
});
