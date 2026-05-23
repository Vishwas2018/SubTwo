import Link from 'next/link';
import { requireAdmin } from '@/lib/auth/session';

const NAV_LINKS = [
  { href: '/admin/invites', label: 'Invites' },
  { href: '/admin/users', label: 'Users' },
  { href: '/admin/ai-usage', label: 'AI Usage' },
] as const;

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireAdmin();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Admin banner — visually distinct from athlete app */}
      <header className="border-b border-red-200 bg-red-50 px-6 py-3">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="rounded bg-red-600 px-2 py-0.5 text-xs font-bold uppercase tracking-widest text-white">
              Admin
            </span>
            <span className="text-sm font-semibold text-red-900">SubTwo Console</span>
          </div>
          <span className="text-xs text-red-700">{profile.email}</span>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-6 py-6">
        <nav className="mb-6 flex gap-1 border-b border-gray-200 pb-4">
          {NAV_LINKS.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className="rounded-md px-4 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900"
            >
              {label}
            </Link>
          ))}
        </nav>

        {children}
      </div>
    </div>
  );
}
