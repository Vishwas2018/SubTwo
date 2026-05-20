import { requireAdmin } from '@/lib/auth/session';

export default async function AdminHome() {
  const profile = await requireAdmin();
  return (
    <main className="p-8">
      <h1 className="text-2xl font-bold">Admin Console</h1>
      <p className="mt-2 text-muted-foreground">Signed in as {profile.email}</p>
      <p className="mt-4 text-sm">Coming in Phase 3: invite codes, users, AI usage.</p>
    </main>
  );
}
