'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { HomeIcon, CalendarDaysIcon, PenLineIcon, UserIcon } from 'lucide-react';

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Home', Icon: HomeIcon },
  { href: '/plan', label: 'Plan', Icon: CalendarDaysIcon },
  { href: '/log', label: 'Log', Icon: PenLineIcon },
  { href: '/settings', label: 'Me', Icon: UserIcon },
] as const;

function useIsActive(href: string) {
  const pathname = usePathname();
  if (href === '/dashboard') return pathname === '/dashboard';
  // /plan matches /plan and /plan/adjustments but not /plan-other
  return pathname === href || pathname.startsWith(href + '/') || pathname.startsWith(href + '?');
}

function NavItem({
  href,
  label,
  Icon,
}: {
  href: string;
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
}) {
  const active = useIsActive(href);

  return (
    <Link
      href={href}
      aria-label={label}
      aria-current={active ? 'page' : undefined}
      // Desktop: full-width row with icon + label
      // Mobile: vertical stack icon + label (handled by parent flex)
      className={[
        // Shared
        'flex items-center gap-3 rounded-lg transition-colors',
        // Desktop row
        'px-3 py-2.5 text-sm font-medium',
        active
          ? 'bg-emerald-50 text-emerald-700'
          : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900',
      ].join(' ')}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span>{label}</span>
    </Link>
  );
}

function MobileNavItem({
  href,
  label,
  Icon,
}: {
  href: string;
  label: string;
  Icon: React.ComponentType<{ className?: string }>;
}) {
  const active = useIsActive(href);

  return (
    <Link
      href={href}
      aria-label={label}
      aria-current={active ? 'page' : undefined}
      className={`flex flex-1 flex-col items-center justify-center gap-0.5 text-xs font-medium transition-colors ${
        active ? 'text-emerald-700' : 'text-slate-500 hover:text-slate-700'
      }`}
    >
      <Icon className={`h-5 w-5 ${active ? 'text-emerald-600' : 'text-slate-400'}`} />
      {label}
    </Link>
  );
}

export function AppNav() {
  return (
    <>
      {/* ── Desktop sidebar ─────────────────────────────────────────────── */}
      <nav
        role="navigation"
        aria-label="Main navigation"
        className="hidden md:flex flex-col fixed left-0 top-0 h-full w-52 bg-white border-r border-slate-200 z-40"
      >
        {/* Logo → dashboard */}
        <Link
          href="/dashboard"
          aria-label="SubTwo — go to dashboard"
          className="flex items-center h-14 px-5 border-b border-slate-100 shrink-0 hover:bg-slate-50 transition-colors"
        >
          <span className="text-lg font-bold text-slate-900 tracking-tight">SubTwo</span>
        </Link>

        {/* Nav items */}
        <div className="flex flex-col gap-1 p-3 flex-1 overflow-y-auto">
          {NAV_ITEMS.map(({ href, label, Icon }) => (
            <NavItem key={href} href={href} label={label} Icon={Icon} />
          ))}
        </div>
      </nav>

      {/* ── Mobile bottom tab bar ────────────────────────────────────────── */}
      <nav
        role="navigation"
        aria-label="Main navigation"
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-slate-200"
      >
        <div className="flex h-14 items-stretch safe-area-inset-bottom">
          {NAV_ITEMS.map(({ href, label, Icon }) => (
            <MobileNavItem key={href} href={href} label={label} Icon={Icon} />
          ))}
        </div>
      </nav>
    </>
  );
}
