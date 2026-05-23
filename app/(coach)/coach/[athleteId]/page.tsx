import { notFound } from 'next/navigation';
import Link from 'next/link';
import { requireUser } from '@/lib/auth/session';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { secondsToTimeString } from '@/lib/pace-zones';
import { distanceLabel } from '@/lib/plans/view-helpers';

function formatDate(dateStr: string) {
  return new Date(dateStr + 'T00:00:00Z').toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

export default async function CoachAthletePage({
  params,
}: {
  params: Promise<{ athleteId: string }>;
}) {
  const { athleteId } = await params;
  const user = await requireUser();
  const supabase = await createClient();

  const { data: access } = await supabase
    .from('viewer_access')
    .select('id, can_comment')
    .eq('viewer_id', user.id)
    .eq('athlete_id', athleteId)
    .eq('status', 'active')
    .maybeSingle();

  if (!access) notFound();

  const svc = createServiceClient();
  const { data: athlete } = await svc
    .from('profiles')
    .select('id, display_name, email')
    .eq('id', athleteId)
    .single();

  if (!athlete) notFound();

  const [planRes, runsRes] = await Promise.all([
    supabase
      .from('plans')
      .select('id, race_name, race_date, race_distance_km, total_weeks, goal_time_seconds')
      .eq('user_id', athleteId)
      .eq('status', 'active')
      .maybeSingle(),
    supabase
      .from('runs')
      .select('id, run_date, distance_km, duration_seconds, avg_pace_seconds, rpe')
      .eq('user_id', athleteId)
      .is('deleted_at', null)
      .order('run_date', { ascending: false })
      .limit(5),
  ]);

  const plan = planRes.data;
  const recentRuns = runsRes.data ?? [];
  const athleteName = athlete.display_name ?? athlete.email;

  return (
    <main className="min-h-screen">
      {/* Coach banner */}
      <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 text-sm text-amber-800 text-center">
        Viewing as coach · read-only
      </div>

      <div className="p-4 md:p-8 max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <Link href="/coach" className="text-sm text-slate-500 hover:text-slate-700">
              ← My athletes
            </Link>
            <h1 className="text-2xl font-bold text-slate-900 mt-1">{athleteName}</h1>
            {athlete.display_name && (
              <p className="text-xs text-slate-400">{athlete.email}</p>
            )}
          </div>
          {access.can_comment && (
            <span className="text-xs text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-1 rounded-full">
              You can comment
            </span>
          )}
        </div>

        {/* Active plan */}
        <section className="rounded-lg border border-slate-200 bg-white p-5 space-y-3">
          <h2 className="font-semibold text-slate-700 text-sm uppercase tracking-wide">
            Training Plan
          </h2>
          {plan ? (
            <div className="space-y-3">
              <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                <dt className="text-slate-500">Race</dt>
                <dd className="font-medium text-slate-800">
                  {plan.race_name ?? distanceLabel(plan.race_distance_km)}
                </dd>
                <dt className="text-slate-500">Date</dt>
                <dd className="font-medium text-slate-800">{formatDate(plan.race_date)}</dd>
                <dt className="text-slate-500">Distance</dt>
                <dd className="font-medium text-slate-800">
                  {distanceLabel(plan.race_distance_km)}
                </dd>
                <dt className="text-slate-500">Weeks</dt>
                <dd className="font-medium text-slate-800">{plan.total_weeks}</dd>
                {plan.goal_time_seconds && (
                  <>
                    <dt className="text-slate-500">Goal time</dt>
                    <dd className="font-medium text-slate-800 font-mono">
                      {secondsToTimeString(plan.goal_time_seconds, { forceHours: true })}
                    </dd>
                  </>
                )}
              </dl>
              <Link
                href={`/coach/${athleteId}/plan`}
                className="inline-flex items-center gap-1 text-sm text-emerald-600 hover:text-emerald-700 font-medium"
              >
                View full plan →
              </Link>
            </div>
          ) : (
            <p className="text-slate-400 text-sm">No active training plan.</p>
          )}
        </section>

        {/* Recent runs */}
        <section className="rounded-lg border border-slate-200 bg-white p-5 space-y-3">
          <h2 className="font-semibold text-slate-700 text-sm uppercase tracking-wide">
            Recent Runs
          </h2>
          {recentRuns.length > 0 ? (
            <div className="divide-y divide-slate-100">
              {recentRuns.map((run) => (
                <div key={run.id} className="py-2 flex items-center justify-between text-sm">
                  <div>
                    <span className="font-medium text-slate-800">{run.distance_km} km</span>
                    <span className="text-slate-400 ml-2">{formatDate(run.run_date)}</span>
                  </div>
                  <div className="flex items-center gap-3 text-slate-500">
                    {run.avg_pace_seconds && (
                      <span className="font-mono text-xs">
                        {secondsToTimeString(run.avg_pace_seconds)} /km
                      </span>
                    )}
                    {run.rpe != null && (
                      <span className="text-xs">RPE {run.rpe}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-slate-400 text-sm">No runs logged yet.</p>
          )}
        </section>
      </div>
    </main>
  );
}
