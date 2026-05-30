// Component tests for SettingsClient — tabs render, profile form, data tab.
// Refs: P2-14
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SettingsClient } from '@/app/(app)/settings/settings-client';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

const mockFetch = vi.fn();
global.fetch = mockFetch;

const PROFILE = {
  id: 'user-1',
  email: 'test@example.com',
  display_name: 'Test User',
  timezone: 'Australia/Melbourne',
  ai_generation_count: 1,
};

const PLAN = {
  id: 'plan-1',
  race_name: 'Melbourne Marathon',
  race_date: '2026-10-04',
  race_distance_km: 42.2,
  total_weeks: 18,
};

function setup(plan = PLAN) {
  return render(<SettingsClient profile={PROFILE} activePlan={plan} />);
}

beforeEach(() => {
  mockFetch.mockReset();
});

describe('SettingsClient', () => {
  it('renders Profile, Sharing, and Data tabs (Integrations hidden until Phase 5/6)', () => {
    setup();
    expect(screen.getByRole('button', { name: 'Profile' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sharing' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Data' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Integrations' })).not.toBeInTheDocument();
  });

  it('shows Profile tab by default', () => {
    setup();
    expect(screen.getByLabelText(/display name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
  });

  it('prefills display name from profile', () => {
    setup();
    const input = screen.getByLabelText(/display name/i) as HTMLInputElement;
    expect(input.value).toBe('Test User');
  });

  it('shows race info from active plan', () => {
    setup();
    expect(screen.getByText('Melbourne Marathon')).toBeInTheDocument();
    expect(screen.getByText('2026-10-04')).toBeInTheDocument();
  });

  it('shows empty state when no active plan', () => {
    render(<SettingsClient profile={PROFILE} activePlan={null} />);
    expect(screen.getByText(/no active training plan/i)).toBeInTheDocument();
  });

  it('shows Start over section when plan is active', () => {
    setup();
    expect(screen.getByText(/regenerate plan/i)).toBeInTheDocument();
  });

  it('switches to Sharing tab', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: [] }),
    });
    const user = userEvent.setup();
    setup();
    await user.click(screen.getByRole('button', { name: 'Sharing' }));
    await waitFor(() => expect(screen.getByText(/coach access/i)).toBeInTheDocument());
    expect(screen.getByRole('button', { name: /invite coach/i })).toBeInTheDocument();
  });

  it('switches to Data tab and shows export/delete', async () => {
    const user = userEvent.setup();
    setup();
    await user.click(screen.getByRole('button', { name: 'Data' }));
    expect(screen.getByRole('button', { name: /download json export/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /delete account/i })).toBeInTheDocument();
  });

  it('saves profile on submit', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: { ...PROFILE, display_name: 'New Name' } }),
    });

    const user = userEvent.setup();
    setup();

    const input = screen.getByLabelText(/display name/i);
    await user.clear(input);
    await user.type(input, 'New Name');

    await user.click(screen.getByRole('button', { name: /save profile/i }));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/me', expect.objectContaining({ method: 'PATCH' }));
    });
  });

  it('shows error on failed save', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: { message: 'Failed to save.' } }),
    });

    const user = userEvent.setup();
    setup();
    await user.click(screen.getByRole('button', { name: /save profile/i }));

    await waitFor(() => {
      expect(screen.getByText(/failed to save/i)).toBeInTheDocument();
    });
  });

  it('shows delete confirm form after clicking Delete Account', async () => {
    const user = userEvent.setup();
    setup();
    await user.click(screen.getByRole('button', { name: 'Data' }));
    await user.click(screen.getByRole('button', { name: /delete account/i }));

    await waitFor(() => {
      expect(screen.getByLabelText(/type.*to confirm/i)).toBeInTheDocument();
    });
  });

  it('disables permanent delete button until email matches', async () => {
    const user = userEvent.setup();
    setup();
    await user.click(screen.getByRole('button', { name: 'Data' }));
    await user.click(screen.getByRole('button', { name: /delete account/i }));

    const confirmInput = await screen.findByLabelText(/type.*to confirm/i);
    const deleteBtn = screen.getByRole('button', { name: /permanently delete/i });

    expect(deleteBtn).toBeDisabled();

    await user.type(confirmInput, 'test@example.com');
    expect(deleteBtn).not.toBeDisabled();
  });

  it('initialTab prop sets active tab on mount', () => {
    render(<SettingsClient profile={PROFILE} activePlan={PLAN} initialTab="data" />);
    expect(screen.getByRole('button', { name: /download json export/i })).toBeInTheDocument();
  });
});
