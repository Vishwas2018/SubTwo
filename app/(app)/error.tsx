'use client';

import { useEffect } from 'react';
import Link from 'next/link';

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    import('@sentry/nextjs').then(({ captureException }) => captureException(error));
  }, [error]);

  return (
    <main className="flex min-h-[60vh] flex-col items-center justify-center p-8 text-center">
      <div className="max-w-sm space-y-4">
        <h2 className="text-xl font-bold text-slate-900">Something went wrong</h2>
        <p className="text-sm text-slate-500">
          An unexpected error occurred. Please try again.
        </p>
        {error.digest && (
          <p className="text-xs text-slate-400 font-mono">Error ID: {error.digest}</p>
        )}
        <div className="flex gap-3 justify-center">
          <button
            onClick={reset}
            className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700"
          >
            Try again
          </button>
          <Link
            href="/dashboard"
            className="px-4 py-2 rounded-lg border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Go to dashboard
          </Link>
        </div>
      </div>
    </main>
  );
}
