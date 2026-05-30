// Unit tests for InlineCheckin dashboard component — submit + collapsed state.
// Refs: UX-D
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { InlineCheckin } from '@/components/dashboard/inline-checkin';

const mockFetch = vi.fn();
global.fetch = mockFetch;

const TODAY = '2026-05-30';

beforeEach(() => {
  mockFetch.mockReset();
});

function submitForm(container: HTMLElement) {
  fireEvent.submit(container.querySelector('form')!);
}

describe('InlineCheckin — no prior check-in', () => {
  it('renders expanded form when prefill is null', () => {
    render(<InlineCheckin today={TODAY} prefill={null} />);
    expect(screen.getByTestId('checkin-form')).toBeInTheDocument();
    expect(screen.getByLabelText(/sleep/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/niggle/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /save check-in/i })).toBeInTheDocument();
  });

  it('niggle toggle reveals description field', async () => {
    const user = userEvent.setup();
    render(<InlineCheckin today={TODAY} prefill={null} />);

    expect(screen.queryByLabelText(/description/i)).not.toBeInTheDocument();

    await user.click(screen.getByLabelText(/niggle/i));
    expect(screen.getByLabelText(/description/i)).toBeInTheDocument();
  });

  it('niggle toggle hides description field when unchecked', async () => {
    const user = userEvent.setup();
    render(<InlineCheckin today={TODAY} prefill={null} />);

    await user.click(screen.getByLabelText(/niggle/i));
    expect(screen.getByLabelText(/description/i)).toBeInTheDocument();

    await user.click(screen.getByLabelText(/niggle/i));
    expect(screen.queryByLabelText(/description/i)).not.toBeInTheDocument();
  });

  it('collapses to "Checked in today" after successful submit', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: { checkin_id: 'ci-1' } }),
    });

    const { container } = render(<InlineCheckin today={TODAY} prefill={null} />);
    submitForm(container);

    await waitFor(() => {
      expect(screen.getByTestId('checkin-collapsed')).toBeInTheDocument();
    });
    expect(screen.getByText(/checked in today/i)).toBeInTheDocument();
  });

  it('shows Edit button in collapsed state', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: { checkin_id: 'ci-1' } }),
    });

    const { container } = render(<InlineCheckin today={TODAY} prefill={null} />);
    submitForm(container);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /edit/i })).toBeInTheDocument();
    });
  });

  it('Edit button expands form again', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: { checkin_id: 'ci-1' } }),
    });

    const user = userEvent.setup();
    const { container } = render(<InlineCheckin today={TODAY} prefill={null} />);
    submitForm(container);

    await waitFor(() => screen.getByRole('button', { name: /edit/i }));
    await user.click(screen.getByRole('button', { name: /edit/i }));

    expect(screen.getByTestId('checkin-form')).toBeInTheDocument();
  });

  it('submits correct payload to /api/checkins', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: { checkin_id: 'ci-2' } }),
    });

    const { container } = render(<InlineCheckin today={TODAY} prefill={null} />);
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

  it('shows error message on API failure', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: { message: 'Failed to save check-in.' } }),
    });

    const { container } = render(<InlineCheckin today={TODAY} prefill={null} />);
    submitForm(container);

    await waitFor(() => {
      expect(screen.getByText(/failed to save check-in/i)).toBeInTheDocument();
    });
    // Form should NOT collapse on failure
    expect(screen.getByTestId('checkin-form')).toBeInTheDocument();
  });
});

describe('InlineCheckin — already checked in (prefill)', () => {
  it('starts collapsed when prefill is provided', () => {
    render(
      <InlineCheckin
        today={TODAY}
        prefill={{ checkin_date: TODAY, sleep_hours: 7, energy_1to5: 3, niggle_today: false }}
      />,
    );
    expect(screen.getByTestId('checkin-collapsed')).toBeInTheDocument();
    expect(screen.getByText(/checked in today/i)).toBeInTheDocument();
  });

  it('shows Edit button when prefill provided', () => {
    render(
      <InlineCheckin
        today={TODAY}
        prefill={{ checkin_date: TODAY, sleep_hours: 8, niggle_today: false }}
      />,
    );
    expect(screen.getByRole('button', { name: /edit/i })).toBeInTheDocument();
  });

  it('Edit expands form with prefilled values', async () => {
    const user = userEvent.setup();
    render(
      <InlineCheckin
        today={TODAY}
        prefill={{ checkin_date: TODAY, sleep_hours: 8.5, niggle_today: false }}
      />,
    );

    await user.click(screen.getByRole('button', { name: /edit/i }));

    const sleepInput = screen.getByLabelText(/sleep/i) as HTMLInputElement;
    expect(sleepInput.value).toBe('8.5');
  });

  it('prefill with niggle_today=true reveals description on edit', async () => {
    const user = userEvent.setup();
    render(
      <InlineCheckin
        today={TODAY}
        prefill={{ checkin_date: TODAY, niggle_today: true, notes: 'Left knee' }}
      />,
    );

    await user.click(screen.getByRole('button', { name: /edit/i }));

    const notesField = screen.getByLabelText(/description/i) as HTMLTextAreaElement;
    expect(notesField.value).toBe('Left knee');
  });
});
