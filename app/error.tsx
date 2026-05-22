'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Error logged here when Sentry is wired up (P3-07)
  }, [error]);

  return (
    <main className="flex min-h-[60vh] flex-col items-center justify-center p-8 text-center">
      <div className="max-w-sm space-y-4">
        <div className="text-4xl">⚠️</div>
        <h2 className="text-xl font-bold text-slate-900">Something went wrong</h2>
        <p className="text-sm text-slate-500">
          An unexpected error occurred. Please try again. If the issue persists, contact support.
        </p>
        {error.digest && (
          <p className="text-xs text-slate-400 font-mono">Error ID: {error.digest}</p>
        )}
        <Button
          onClick={reset}
          className="bg-emerald-600 hover:bg-emerald-700 text-white"
        >
          Try again
        </Button>
      </div>
    </main>
  );
}
