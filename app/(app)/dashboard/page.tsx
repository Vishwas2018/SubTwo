import { requireUser } from '@/lib/auth/session';

export default async function DashboardPage() {
  const user = await requireUser();
  return (
    <main className="p-8">
      <h1 className="text-2xl font-bold">Dashboard</h1>
      <p className="mt-2 text-muted-foreground">Welcome, {user.email}</p>
      <p className="mt-4 text-sm">Coming in Phase 2: trends, alerts, and your training plan.</p>
    </main>
  );
}
