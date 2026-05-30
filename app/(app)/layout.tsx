import { AppNav } from '@/components/app-nav';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50">
      <AppNav />
      {/* Offset content: left margin for desktop sidebar, bottom padding for mobile tab bar */}
      <div className="md:pl-52 pb-16 md:pb-0">
        {children}
      </div>
    </div>
  );
}
