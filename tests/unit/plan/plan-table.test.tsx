// RTL tests for the /plan PlanTable + PlanTableEmpty components.
// Refs: P2-07
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { PlanTable, PlanTableEmpty } from '@/app/(app)/plan/plan-table';
import type { PlannedSession } from '@/lib/plans/view-helpers';

// ─── Mock next/link ───────────────────────────────────────────────────────────

vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode; className?: string; title?: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

// ─── Fix Melbourne today to a stable date ─────────────────────────────────────

vi.mock('@/lib/plans/view-helpers', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/lib/plans/view-helpers')>();
  return {
    ...original,
    melbourneToday: () => '2026-06-15',
  };
});

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeSession(overrides: Partial<PlannedSession>): PlannedSession {
  return {
    id: 'sess-1',
    plan_id: 'plan-1',
    plan_version_id: 'ver-1',
    week_number: 1,
    day_of_week: 1,
    phase: 'base',
    session_type: 'easy',
    distance_km: 8,
    scheduled_date: '2026-06-16', // future
    target_pace_min: null,
    target_pace_max: null,
    focus: null,
    structure: null,
    notes: null,
    is_checkpoint: false,
    is_deload: false,
    checkpoint_type: null,
    created_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

const SESSIONS: PlannedSession[] = [
  makeSession({ id: 'w1-mon', week_number: 1, day_of_week: 1, session_type: 'easy', distance_km: 8, scheduled_date: '2026-06-16' }),
  makeSession({ id: 'w1-wed', week_number: 1, day_of_week: 3, session_type: 'threshold', distance_km: 10, scheduled_date: '2026-06-18' }),
  makeSession({ id: 'w1-sun', week_number: 1, day_of_week: 7, session_type: 'long_run', distance_km: 16, scheduled_date: '2026-06-22' }),
  makeSession({ id: 'w1-rest', week_number: 1, day_of_week: 2, session_type: 'rest', distance_km: null, scheduled_date: '2026-06-17' }),
  makeSession({ id: 'w2-mon', week_number: 2, day_of_week: 1, phase: 'build', session_type: 'easy', distance_km: 10, scheduled_date: '2026-06-23' }),
  makeSession({ id: 'w2-sat', week_number: 2, day_of_week: 6, phase: 'build', session_type: 'long_run', distance_km: 18, scheduled_date: '2026-06-28' }),
];

// ─── PlanTableEmpty ───────────────────────────────────────────────────────────

describe('PlanTableEmpty', () => {
  it('renders empty state with wizard link', () => {
    render(<PlanTableEmpty />);
    expect(screen.getByText(/no active plan/i)).toBeTruthy();
    expect(screen.getByRole('link', { name: /start wizard/i })).toBeTruthy();
  });
});

// ─── PlanTable ────────────────────────────────────────────────────────────────

describe('PlanTable', () => {
  it('renders week rows for all weeks in totalWeeks', () => {
    render(<PlanTable sessions={SESSIONS} totalWeeks={2} />);
    // Week labels
    expect(screen.getAllByText(/W1/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/W2/).length).toBeGreaterThanOrEqual(1);
  });

  it('renders phase filter tabs', () => {
    render(<PlanTable sessions={SESSIONS} totalWeeks={2} />);
    expect(screen.getByRole('button', { name: /^all$/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /^base$/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /^build$/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /^peak$/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /^taper$/i })).toBeTruthy();
  });

  it('shows E, T, L, Rest abbreviations', () => {
    render(<PlanTable sessions={SESSIONS} totalWeeks={2} />);
    // Multiple E cells (both weeks have easy runs) — use getAllByText
    expect(screen.getAllByText('E').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('T').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('L').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Rest').length).toBeGreaterThanOrEqual(1);
  });

  it('links to /session/<id> for each session cell', () => {
    render(<PlanTable sessions={SESSIONS} totalWeeks={2} />);
    const links = screen.getAllByRole('link');
    const sessionLinks = links.filter((l) => l.getAttribute('href')?.startsWith('/session/'));
    // Should have links for non-rest sessions (5 non-rest sessions × desktop+mobile but DOM may vary)
    expect(sessionLinks.length).toBeGreaterThanOrEqual(5);
  });

  it('filters to only build-phase weeks when Build tab is clicked', async () => {
    const user = userEvent.setup();
    render(<PlanTable sessions={SESSIONS} totalWeeks={2} />);

    await user.click(screen.getByRole('button', { name: /^build$/i }));

    // W1 (base) should not show current-week marker; W2 (build) should appear
    // Build filter: only W2 visible → W1 row gone
    expect(screen.queryByText(/W1/)).toBeNull();
    expect(screen.getAllByText(/W2/).length).toBeGreaterThanOrEqual(1);
  });

  it('shows all weeks when All tab clicked after filtering', async () => {
    const user = userEvent.setup();
    render(<PlanTable sessions={SESSIONS} totalWeeks={2} />);

    await user.click(screen.getByRole('button', { name: /^build$/i }));
    await user.click(screen.getByRole('button', { name: /^all$/i }));

    expect(screen.getAllByText(/W1/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/W2/).length).toBeGreaterThanOrEqual(1);
  });

  it('shows legend', () => {
    render(<PlanTable sessions={SESSIONS} totalWeeks={2} />);
    expect(screen.getByText(/completed/i)).toBeTruthy();
    expect(screen.getByText(/missed/i)).toBeTruthy();
  });

  it('renders today marker when session is scheduled for today', () => {
    const todaySessions: PlannedSession[] = [
      makeSession({ id: 'today-sess', week_number: 1, day_of_week: 1, scheduled_date: '2026-06-15' }),
    ];
    render(<PlanTable sessions={todaySessions} totalWeeks={1} />);
    // "now" indicator or blue styling — check for "now" text
    expect(screen.getByText(/now/i)).toBeTruthy();
  });

  it('renders empty plan (no sessions) with correct row count', () => {
    render(<PlanTable sessions={[]} totalWeeks={3} />);
    // 3 week rows with no sessions
    expect(screen.getAllByText(/W[123]/).length).toBeGreaterThanOrEqual(3);
  });
});
