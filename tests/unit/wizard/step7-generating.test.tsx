import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { Step7Generating } from '@/components/wizard/steps/step7-generating';
import type { GenerateError } from '@/components/wizard/wizard-types';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

const NO_RETRY = 0;

// ─── Loading state ────────────────────────────────────────────────────────────

describe('Step7Generating — loading', () => {
  it('shows "Building your plan" heading when no error', () => {
    render(<Step7Generating error={null} retryingIn={NO_RETRY} />);
    expect(screen.getByText('Building your plan')).toBeInTheDocument();
  });

  it('shows first progress message', () => {
    render(<Step7Generating error={null} retryingIn={NO_RETRY} />);
    expect(screen.getByText('Analysing your fitness data…')).toBeInTheDocument();
  });
});

// ─── Error states ─────────────────────────────────────────────────────────────

describe('Step7Generating — timeout (504)', () => {
  const error: GenerateError = {
    type: 'timeout',
    title: 'Generation is taking longer than expected',
    message: 'Plans usually take 20–40 seconds.',
  };

  it('shows timeout title', () => {
    render(<Step7Generating error={error} retryingIn={NO_RETRY} />);
    expect(screen.getByTestId('error-title')).toHaveTextContent(
      'Generation is taking longer than expected',
    );
  });

  it('shows retry button', () => {
    const onRetry = vi.fn();
    render(<Step7Generating error={error} retryingIn={NO_RETRY} onRetry={onRetry} />);
    expect(screen.getByTestId('retry-button')).toBeInTheDocument();
  });

  it('calls onRetry when button clicked', async () => {
    const onRetry = vi.fn();
    render(<Step7Generating error={error} retryingIn={NO_RETRY} onRetry={onRetry} />);
    await userEvent.click(screen.getByTestId('retry-button'));
    expect(onRetry).toHaveBeenCalledOnce();
  });
});

describe('Step7Generating — rate_limit (429)', () => {
  const error: GenerateError = {
    type: 'rate_limit',
    title: 'Daily generation limit reached',
    message: "You've used all 3 generations for today. Try again in 5 min.",
    retryAfter: 300,
  };

  it('shows rate_limit title', () => {
    render(<Step7Generating error={error} retryingIn={NO_RETRY} />);
    expect(screen.getByTestId('error-title')).toHaveTextContent('Daily generation limit reached');
  });

  it('shows message with time', () => {
    render(<Step7Generating error={error} retryingIn={NO_RETRY} />);
    expect(screen.getByTestId('error-message')).toHaveTextContent('3 generations for today');
  });

  it('shows no retry button (user must wait)', () => {
    render(<Step7Generating error={error} retryingIn={NO_RETRY} onRetry={vi.fn()} />);
    expect(screen.queryByTestId('retry-button')).not.toBeInTheDocument();
  });
});

describe('Step7Generating — quota (quota_exhausted)', () => {
  const error: GenerateError = {
    type: 'quota',
    title: 'Generation limit reached',
    message: 'daily quota exceeded',
  };

  it('shows quota title', () => {
    render(<Step7Generating error={error} retryingIn={NO_RETRY} />);
    expect(screen.getByTestId('error-title')).toHaveTextContent('Generation limit reached');
  });

  it('shows contact admin link', () => {
    render(<Step7Generating error={error} retryingIn={NO_RETRY} />);
    expect(screen.getByText('Contact admin')).toBeInTheDocument();
  });

  it('shows no retry button', () => {
    render(<Step7Generating error={error} retryingIn={NO_RETRY} onRetry={vi.fn()} />);
    expect(screen.queryByTestId('retry-button')).not.toBeInTheDocument();
  });
});

describe('Step7Generating — validation (400)', () => {
  const error: GenerateError = {
    type: 'validation',
    title: 'Invalid request',
    message: 'Race date must be in the future.',
  };

  it('shows server message verbatim', () => {
    render(<Step7Generating error={error} retryingIn={NO_RETRY} />);
    expect(screen.getByTestId('error-message')).toHaveTextContent(
      'Race date must be in the future.',
    );
  });

  it('shows retry button', () => {
    render(<Step7Generating error={error} retryingIn={NO_RETRY} onRetry={vi.fn()} />);
    expect(screen.getByTestId('retry-button')).toBeInTheDocument();
  });
});

describe('Step7Generating — auth (401/403)', () => {
  const error: GenerateError = {
    type: 'auth',
    title: 'Session expired',
    message: 'Please log in again.',
  };

  it('shows auth title', () => {
    render(<Step7Generating error={error} retryingIn={NO_RETRY} />);
    expect(screen.getByTestId('error-title')).toHaveTextContent('Session expired');
  });

  it('shows "Log in again" link', () => {
    render(<Step7Generating error={error} retryingIn={NO_RETRY} />);
    expect(screen.getByText('Log in again')).toBeInTheDocument();
  });

  it('shows no retry button', () => {
    render(<Step7Generating error={error} retryingIn={NO_RETRY} onRetry={vi.fn()} />);
    expect(screen.queryByTestId('retry-button')).not.toBeInTheDocument();
  });
});

describe('Step7Generating — service (500/502/503)', () => {
  const error: GenerateError = {
    type: 'service',
    title: 'Service temporarily unavailable',
    message: 'Our service is temporarily unavailable. Retry in a moment.',
  };

  it('shows service title', () => {
    render(<Step7Generating error={error} retryingIn={NO_RETRY} />);
    expect(screen.getByTestId('error-title')).toHaveTextContent('Service temporarily unavailable');
  });

  it('shows retry button', () => {
    render(<Step7Generating error={error} retryingIn={NO_RETRY} onRetry={vi.fn()} />);
    expect(screen.getByTestId('retry-button')).toBeInTheDocument();
  });
});

describe('Step7Generating — network (no response)', () => {
  const error: GenerateError = {
    type: 'network',
    title: "Couldn't reach SubTwo",
    message: 'Check your connection and retry.',
  };

  it('shows network title', () => {
    render(<Step7Generating error={error} retryingIn={NO_RETRY} />);
    expect(screen.getByTestId('error-title')).toHaveTextContent("Couldn't reach SubTwo");
  });

  it('shows retry button', () => {
    render(<Step7Generating error={error} retryingIn={NO_RETRY} onRetry={vi.fn()} />);
    expect(screen.getByTestId('retry-button')).toBeInTheDocument();
  });
});

// ─── Auto-retry countdown ─────────────────────────────────────────────────────

describe('Step7Generating — auto-retry countdown', () => {
  const error: GenerateError = {
    type: 'timeout',
    title: 'Generation is taking longer than expected',
    message: 'Plans usually take 20–40 seconds.',
  };

  it('shows countdown text when retryingIn > 0', () => {
    render(<Step7Generating error={error} retryingIn={3} />);
    expect(screen.getByTestId('retry-countdown')).toHaveTextContent('Retrying in 3s');
  });

  it('hides retry button during countdown', () => {
    render(<Step7Generating error={error} retryingIn={2} onRetry={vi.fn()} />);
    expect(screen.queryByTestId('retry-button')).not.toBeInTheDocument();
  });

  it('shows retry button when countdown reaches 0', () => {
    render(<Step7Generating error={error} retryingIn={0} onRetry={vi.fn()} />);
    expect(screen.queryByTestId('retry-countdown')).not.toBeInTheDocument();
    expect(screen.getByTestId('retry-button')).toBeInTheDocument();
  });
});
