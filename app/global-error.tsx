'use client';

import { useEffect } from 'react';

export default function GlobalError({
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
    <html lang="en">
      <body className="flex min-h-screen flex-col items-center justify-center p-8 text-center font-sans antialiased">
        <div className="max-w-sm space-y-4">
          <div className="text-4xl">💥</div>
          <h1 className="text-xl font-bold text-slate-900">Critical error</h1>
          <p className="text-sm text-slate-500">
            A critical error occurred. Please reload the page.
          </p>
          {error.digest && (
            <p className="text-xs text-slate-400 font-mono">Error ID: {error.digest}</p>
          )}
          <button
            onClick={reset}
            className="inline-flex items-center rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 transition-colors"
          >
            Reload
          </button>
        </div>
      </body>
    </html>
  );
}
