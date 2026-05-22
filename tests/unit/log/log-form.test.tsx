// Component tests for /log LogForm — validation, conditional stitch severity, prefill.
// Refs: P2-09
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LogForm } from '@/app/(app)/log/log-form';

// Mock Next.js router
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

const mockFetch = vi.fn();
global.fetch = mockFetch;

function setup(props?: Partial<React.ComponentProps<typeof LogForm>>) {
  return render(
    <LogForm
      defaultDate="2026-05-22"
      defaultSessionId={null}
      sessions={[]}
      {...props}
    />,
  );
}

function submitForm(container: HTMLElement) {
  fireEvent.submit(container.querySelector('form')!);
}

beforeEach(() => {
  mockFetch.mockReset();
});

describe('LogForm', () => {
  it('renders required fields', () => {
    setup();
    expect(screen.getByLabelText(/date/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/distance/i)).toBeInTheDocument();
    expect(screen.getByText(/duration/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /log run/i })).toBeInTheDocument();
  });

  it('prefills date from defaultDate prop', () => {
    setup({ defaultDate: '2026-05-20' });
    expect((screen.getByLabelText(/date/i) as HTMLInputElement).value).toBe('2026-05-20');
  });

  it('shows error if distance is missing on submit', async () => {
    const { container } = setup();
    submitForm(container);
    await waitFor(() => {
      expect(screen.getByText(/distance is required/i)).toBeInTheDocument();
    });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('shows error if duration is zero on submit', async () => {
    const { container } = setup();
    fireEvent.change(screen.getByLabelText(/distance \(km\)/i), { target: { value: '5' } });
    submitForm(container);
    await waitFor(() => {
      expect(screen.getByText(/duration is required/i)).toBeInTheDocument();
    });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('shows stitch severity field when stitch occurred is checked', async () => {
    const user = userEvent.setup();
    setup();
    expect(screen.queryByText(/stitch severity/i)).not.toBeInTheDocument();
    await user.click(screen.getByRole('checkbox', { name: /stitch occurred/i }));
    expect(screen.getByText(/stitch severity/i)).toBeInTheDocument();
  });

  it('hides stitch severity when unchecked', async () => {
    const user = userEvent.setup();
    setup();
    await user.click(screen.getByRole('checkbox', { name: /stitch occurred/i }));
    expect(screen.getByText(/stitch severity/i)).toBeInTheDocument();
    await user.click(screen.getByRole('checkbox', { name: /stitch occurred/i }));
    expect(screen.queryByText(/stitch severity/i)).not.toBeInTheDocument();
  });

  it('requires stitch severity when stitch occurred', async () => {
    const user = userEvent.setup();
    const { container } = setup();
    await user.click(screen.getByRole('checkbox', { name: /stitch occurred/i }));
    fireEvent.change(screen.getByLabelText(/distance \(km\)/i), { target: { value: '10' } });
    // Set minutes so duration > 0
    const minutesInput = screen.getAllByRole('spinbutton').find(
      (el) => (el as HTMLInputElement).placeholder === '00',
    )!;
    fireEvent.change(minutesInput, { target: { value: '45' } });
    submitForm(container);
    await waitFor(() => {
      expect(screen.getByText(/stitch severity is required/i)).toBeInTheDocument();
    });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('shows session dropdown when sessions prop provided', () => {
    setup({
      sessions: [{ id: 'sess-1', label: 'Long Run', scheduled_date: '2026-05-22' }],
      defaultSessionId: 'sess-1',
    });
    expect(screen.getByLabelText(/link to planned session/i)).toBeInTheDocument();
  });

  it('submits with correct payload on valid form', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: { run_id: 'run-123' } }),
    });

    const { container } = setup();
    fireEvent.change(screen.getByLabelText(/distance \(km\)/i), { target: { value: '10' } });
    const minutesInput = screen.getAllByRole('spinbutton').find(
      (el) => (el as HTMLInputElement).placeholder === '00',
    )!;
    fireEvent.change(minutesInput, { target: { value: '45' } });
    submitForm(container);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/runs',
        expect.objectContaining({ method: 'POST' }),
      );
    });
    const callBody = JSON.parse(
      (mockFetch.mock.calls[0] as [string, RequestInit])[1].body as string,
    ) as Record<string, unknown>;
    expect(callBody.distance_km).toBe(10);
    expect(callBody.duration_seconds).toBe(45 * 60);
    expect(callBody.run_date).toBe('2026-05-22');
  });

  it('shows API error message on failed submit', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: { message: 'Failed to save run.' } }),
    });

    const { container } = setup();
    fireEvent.change(screen.getByLabelText(/distance \(km\)/i), { target: { value: '5' } });
    const minutesInput = screen.getAllByRole('spinbutton').find(
      (el) => (el as HTMLInputElement).placeholder === '00',
    )!;
    fireEvent.change(minutesInput, { target: { value: '30' } });
    submitForm(container);
    await waitFor(() => {
      expect(screen.getByText(/failed to save run/i)).toBeInTheDocument();
    });
  });
});
