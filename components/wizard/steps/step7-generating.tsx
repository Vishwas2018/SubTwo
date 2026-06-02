'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Progress } from '@/components/ui/progress';
import type { GenerateError } from '@/components/wizard/wizard-types';

const MESSAGES = [
  'Analysing your fitness data…',
  'Designing periodisation structure…',
  'Calculating pace zones…',
  'Placing checkpoints…',
  'Finalising your plan…',
];

type Props = {
  error: GenerateError | null;
  retryingIn: number; // countdown seconds (3, 2, 1); 0 = not retrying
  onRetry?: () => void;
};

function formatRetryAfter(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.round(seconds / 60);
  return `${mins} min`;
}

function ErrorView({ error, retryingIn, onRetry }: Props & { error: GenerateError }) {
  const isRetrying = retryingIn > 0;

  const iconMap: Record<GenerateError['type'], string> = {
    timeout: '⏱',
    rate_limit: '⏳',
    quota: '⚠️',
    validation: '⚠️',
    auth: '🔒',
    service: '🔧',
    network: '📡',
  };

  return (
    <div className="space-y-4 text-center py-8" data-testid="generate-error">
      <div className="text-4xl" aria-hidden="true">{iconMap[error.type]}</div>

      <h2 className="text-xl font-semibold text-slate-900" data-testid="error-title">
        {error.title}
      </h2>

      <p className="text-sm text-slate-500 max-w-sm mx-auto" role="alert" data-testid="error-message">
        {error.type === 'auth' ? (
          <>
            {error.message}{' '}
            <Link href="/login" className="text-emerald-600 hover:underline">
              Log in again
            </Link>
          </>
        ) : error.type === 'quota' ? (
          <>
            {error.message}{' '}
            <a
              href="mailto:vishwas.joshi01@gmail.com?subject=SubTwo%20%E2%80%94%20generation%20limit"
              className="text-emerald-600 hover:underline"
            >
              Contact admin
            </a>{' '}
            to request more.
          </>
        ) : (
          error.message
        )}
      </p>

      {isRetrying ? (
        <p className="text-sm text-slate-400" data-testid="retry-countdown">
          Retrying in {retryingIn}s…
        </p>
      ) : (
        onRetry &&
        error.type !== 'auth' &&
        error.type !== 'quota' &&
        error.type !== 'rate_limit' && (
          <button
            onClick={onRetry}
            className="mt-2 rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 transition-colors"
            data-testid="retry-button"
          >
            Try again
          </button>
        )
      )}
    </div>
  );
}

export function Step7Generating({ error, retryingIn, onRetry }: Props) {
  const [msgIndex, setMsgIndex] = useState(0);
  const [progress, setProgress] = useState(5);

  useEffect(() => {
    if (error) return;

    const msgInterval = setInterval(() => {
      setMsgIndex((i) => Math.min(i + 1, MESSAGES.length - 1));
    }, 4000);

    const progressInterval = setInterval(() => {
      setProgress((p) => {
        const next = p + Math.random() * 8 + 2;
        return Math.min(next, 92);
      });
    }, 1200);

    return () => {
      clearInterval(msgInterval);
      clearInterval(progressInterval);
    };
  }, [error]);

  // Reset animation when error clears (auto-retry restarts generation)
  useEffect(() => {
    if (!error) {
      setMsgIndex(0);
      setProgress(5);
    }
  }, [error]);

  if (error) {
    return <ErrorView error={error} retryingIn={retryingIn} onRetry={onRetry} />;
  }

  return (
    <div className="space-y-6 text-center py-8">
      <div className="text-4xl animate-pulse" aria-hidden="true">🏃</div>
      <h2 className="text-xl font-semibold text-slate-900">Building your plan</h2>
      <p
        className="text-sm text-slate-500 min-h-5 transition-all"
        aria-live="polite"
      >
        {MESSAGES[msgIndex]}
      </p>
      <div className="max-w-sm mx-auto space-y-1">
        <Progress value={progress} className="h-2" aria-label="Generation progress" />
        <p className="text-xs text-slate-400">This takes 20–40 seconds</p>
      </div>
    </div>
  );
}

export { formatRetryAfter };
