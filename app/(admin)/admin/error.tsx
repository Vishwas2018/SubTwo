'use client';

import { useEffect } from 'react';
import Link from 'next/link';

export default function AdminError({
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
    <div className="flex min-h-[60vh] flex-col items-center justify-center p-8 text-center">
      <div className="max-w-sm space-y-4">
        <h2 className="text-xl font-bold text-gray-900">Admin error</h2>
        <p className="text-sm text-gray-500">An unexpected error occurred in the admin console.</p>
        {error.digest && (
          <p className="text-xs text-gray-400 font-mono">Error ID: {error.digest}</p>
        )}
        <div className="flex gap-3 justify-center">
          <button
            onClick={reset}
            className="px-4 py-2 rounded-md bg-red-600 text-white text-sm font-medium hover:bg-red-700"
          >
            Try again
          </button>
          <Link
            href="/admin"
            className="px-4 py-2 rounded-md border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Admin home
          </Link>
        </div>
      </div>
    </div>
  );
}
