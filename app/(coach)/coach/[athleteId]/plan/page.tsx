import { notFound } from 'next/navigation';
import Link from 'next/link';
import { requireUser } from '@/lib/auth/session';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { secondsToTimeString } from '@/lib/pace-zones';
import { PlanTable, PlanTableEmpty } from '@/app/(app)/plan/plan-table';
import { distanceLabel } from '@/lib/plans/view-helpers';

export default async function CoachAthletePlanPage({
  params,
}: {
  params: Promise<{ athleteId: string }>;
}) {
  const { athleteId } = await params;
  const user = await requireUser();
  const supabase = await createClient();

  const { data: access } = await supabase
    .from('viewer_access')
    .select('id')
    .eq('viewer_id', user.id)
    .eq('athlete_id', athleteId)
    .eq('status', 'active')
    .maybeSingle();

  if (!access) notFound();

  const svc = createServiceClient();
  const { data: athlete } = await svc
    .from('profiles')
    .select('display_name, email')
    .eq('id', athleteId)
    .single();

  if (!athlete) notFound();

  const { data: plan } = await supabase
    .from('plans')
    .select('*')
    .eq('user_id', athleteId)
    .eq('status', 'active')
    .maybeSingle();

  const athleteName = athlete.display_name ?? athlete.email;

  if (!plan) {
    return (
      <main className="min-h-screen">
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 text-sm text-amber-800 text-center">
          Viewing as coach · read-only
        </div>
        <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-6">
          <Link href={`/coach/${athleteId}`} className="text-sm text-slate-500 hover:text-slate-700">
            ← Back to {athleteName}
          </Link>
          <PlanTableEmpty />
        </div>
      </main>
    );
  }

  const { data: sessions } = await supabase
    .from('planned_sessions')
    .select('*')
    .eq('plan_id', plan.id)
    .eq('plan_version_id', plan.current_version_id ?? '')
    .order('week_number', { ascending: true })
    .order('day_of_week', { ascending: true });

  const raceLabel = distanceLabel(plan.race_distance_km);
  const raceName = plan.race_name ?? raceLabel;
  const raceDate = new Date(plan.race_date + 'T00:00:00Z').toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });

  return (
    <main className="min-h-screen">
      <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 text-sm text-amber-800 text-center">
        Viewing as coach · read-only
      </div>

      <div className="p-4 md:p-8 max-w-6xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <Link
              href={`/coach/${athleteId}`}
              className="text-sm text-slate-500 hover:text-slate-700"
            >
              ← Back to {athleteName}
            </Link>
            <h1 className="text-2xl font-bold text-slate-900 mt-1">{raceName}</h1>
            <p className="text-slate-500 text-sm mt-0.5">
              {plan.total_weeks}-week plan · {raceLabel} · {raceDate}
              {plan.goal_time_seconds && (
                <> · Goal: {secondsToTimeString(plan.goal_time_seconds, { forceHours: true })}</>
              )}
            </p>
          </div>
          <div className="text-sm text-slate-500">{(sessions ?? []).length} sessions</div>
        </div>

        <PlanTable
          sessions={sessions ?? []}
          totalWeeks={plan.total_weeks}
          baseSessionHref={`/coach/${athleteId}/session`}
        />
      </div>
    </main>
  );
}
