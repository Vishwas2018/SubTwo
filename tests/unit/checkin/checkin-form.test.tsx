// Component tests for /check-in CheckinForm — upsert prefill, submission.
// Refs: P2-10
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CheckinForm } from '@/app/(app)/check-in/checkin-form';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

const mockFetch = vi.fn();
global.fetch = mockFetch;

const TODAY = '2026-05-22';

beforeEach(() => {
  mockFetch.mockReset();
});

function submitForm(container: HTMLElement) {
  fireEvent.submit(container.querySelector('form')!);
}

describe('CheckinForm', () => {
  it('renders all fields with no prefill', () => {
    render(<CheckinForm today={TODAY} prefill={null} />);
    expect(screen.getByLabelText(/sleep/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/resting hr/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/weight/i)).toBeInTheDocument();
    expect(screen.getByText(/energy level/i)).toBeInTheDocument();
    expect(screen.getByText(/^mood$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/niggle/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/notes/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /save check-in/i })).toBeInTheDocument();
  });

  it('shows "Update Check-in" label when prefill provided', () => {
    render(
      <CheckinForm
        today={TODAY}
        prefill={{ checkin_date: TODAY, sleep_hours: 7, energy_1to5: 3, niggle_today: false }}
      />,
    );
    expect(screen.getByRole('button', { name: /update check-in/i })).toBeInTheDocument();
  });

  it('prefills sleep_hours from prefill prop', () => {
    render(
      <CheckinForm
        today={TODAY}
        prefill={{ checkin_date: TODAY, sleep_hours: 8.5, niggle_today: false }}
      />,
    );
    const sleepInput = screen.getByLabelText(/sleep/i) as HTMLInputElement;
    expect(sleepInput.value).toBe('8.5');
  });

  it('prefills notes from prefill prop', () => {
    render(
      <CheckinForm
        today={TODAY}
        prefill={{ checkin_date: TODAY, notes: 'Legs tired', niggle_today: false }}
      />,
    );
    const notesInput = screen.getByLabelText(/notes/i) as HTMLTextAreaElement;
    expect(notesInput.value).toBe('Legs tired');
  });

  it('energy rating buttons select value', async () => {
    const user = userEvent.setup();
    render(<CheckinForm today={TODAY} prefill={null} />);
    const btn4 = screen.getByRole('button', { name: /energy 4/i });
    await user.click(btn4);
    expect(btn4.className).toContain('bg-emerald-600');
  });

  it('submits check-in with correct payload', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: { checkin_id: 'ci-1' } }),
    });

    const { container } = render(<CheckinForm today={TODAY} prefill={null} />);
    fireEvent.change(screen.getByLabelText(/sleep/i), { target: { value: '7.5' } });
    submitForm(container);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/checkins',
        expect.objectContaining({ method: 'POST' }),
      );
    });

    const body = JSON.parse(
      (mockFetch.mock.calls[0] as [string, RequestInit])[1].body as string,
    ) as Record<string, unknown>;
    expect(body.checkin_date).toBe(TODAY);
    expect(body.sleep_hours).toBe(7.5);
    expect(body.niggle_today).toBe(false);
  });

  it('shows "Check-in saved" on success', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: { checkin_id: 'ci-1' } }),
    });

    const { container } = render(<CheckinForm today={TODAY} prefill={null} />);
    submitForm(container);

    await waitFor(() => {
      expect(screen.getByText(/check-in saved/i)).toBeInTheDocument();
    });
  });

  it('shows API error on failure', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: { message: 'Failed to save check-in.' } }),
    });

    const { container } = render(<CheckinForm today={TODAY} prefill={null} />);
    submitForm(container);

    await waitFor(() => {
      expect(screen.getByText(/failed to save check-in/i)).toBeInTheDocument();
    });
  });
});
