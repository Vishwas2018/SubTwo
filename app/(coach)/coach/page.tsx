import Link from 'next/link';
import { requireUser } from '@/lib/auth/session';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

export default async function CoachPage() {
  const user = await requireUser();
  const supabase = await createClient();

  const { data: accesses } = await supabase
    .from('viewer_access')
    .select('athlete_id, can_comment')
    .eq('viewer_id', user.id)
    .eq('status', 'active');

  if (!accesses || accesses.length === 0) redirect('/dashboard');

  const svc = createServiceClient();
  const athleteIds = accesses.map((a) => a.athlete_id);
  const { data: athletes } = await svc
    .from('profiles')
    .select('id, display_name, email')
    .in('id', athleteIds);

  const commentMap = new Map(accesses.map((a) => [a.athlete_id, a.can_comment]));

  return (
    <main className="p-4 md:p-8 max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">My Athletes</h1>
          <p className="text-slate-500 text-sm mt-1">Read-only access to training plans.</p>
        </div>
        <Link
          href="/dashboard"
          className="text-sm text-slate-500 hover:text-slate-700"
        >
          My dashboard →
        </Link>
      </div>

      <div className="space-y-3">
        {(athletes ?? []).map((athlete) => (
          <Link
            key={athlete.id}
            href={`/coach/${athlete.id}`}
            className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-4 hover:border-slate-300 hover:bg-slate-50 transition-colors"
          >
            <div>
              <p className="font-medium text-slate-900">
                {athlete.display_name ?? athlete.email}
              </p>
              {athlete.display_name && (
                <p className="text-xs text-slate-400">{athlete.email}</p>
              )}
            </div>
            <div className="flex items-center gap-2">
              {commentMap.get(athlete.id) && (
                <span className="text-xs text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                  can comment
                </span>
              )}
              <span className="text-slate-400 text-sm">→</span>
            </div>
          </Link>
        ))}
      </div>
    </main>
  );
}
