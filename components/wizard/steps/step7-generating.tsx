'use client';

import { useEffect, useState } from 'react';
import { Progress } from '@/components/ui/progress';

const MESSAGES = [
  'Analysing your fitness data…',
  'Designing periodisation structure…',
  'Calculating pace zones…',
  'Placing checkpoints…',
  'Finalising your plan…',
];

type Props = {
  error: string | null;
  onRetry?: () => void;
};

export function Step7Generating({ error, onRetry }: Props) {
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

  if (error) {
    const isQuota = error.includes('quota');
    return (
      <div className="space-y-4 text-center py-8">
        <div className="text-4xl">
          {isQuota ? '⚠️' : '❌'}
        </div>
        <h2 className="text-xl font-semibold text-slate-900">
          {isQuota ? 'Generation limit reached' : 'Something went wrong'}
        </h2>
        <p className="text-sm text-slate-500 max-w-sm mx-auto" role="alert">
          {isQuota ? (
            <>
              Your plan generation limit has been reached.{' '}
              <a
                href="mailto:vishwas.joshi01@gmail.com?subject=SubTwo%20%E2%80%94%20generation%20limit"
                className="text-emerald-600 hover:underline"
              >
                Contact the admin
              </a>{' '}
              to request more.
            </>
          ) : (
            error
          )}
        </p>
        {!isQuota && onRetry && (
          <button
            onClick={onRetry}
            className="mt-2 rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 transition-colors"
          >
            Try again
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6 text-center py-8">
      <div className="text-4xl animate-pulse">🏃</div>
      <h2 className="text-xl font-semibold text-slate-900">Building your plan</h2>
      <p
        className="text-sm text-slate-500 min-h-[1.25rem] transition-all"
        aria-live="polite"
      >
        {MESSAGES[msgIndex]}
      </p>
      <div className="max-w-sm mx-auto space-y-1">
        <Progress value={progress} className="h-2" aria-label="Generation progress" />
        <p className="text-xs text-slate-400">This takes 15–30 seconds</p>
      </div>
    </div>
  );
}
