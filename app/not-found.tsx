import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="flex min-h-[60vh] flex-col items-center justify-center p-8 text-center">
      <div className="max-w-sm space-y-4">
        <div className="text-5xl font-black text-slate-200">404</div>
        <h2 className="text-xl font-bold text-slate-900">Page not found</h2>
        <p className="text-sm text-slate-500">
          The page you are looking for does not exist or has been moved.
        </p>
        <Link
          href="/dashboard"
          className="inline-flex items-center rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 transition-colors"
        >
          Go to Dashboard
        </Link>
      </div>
    </main>
  );
}
