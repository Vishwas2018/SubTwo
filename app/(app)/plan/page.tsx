import { requireUser } from '@/lib/auth/session';
import { getActivePlan } from '@/lib/plans/queries';
import { secondsToTimeString } from '@/lib/pace-zones';
import { PlanTable, PlanTableEmpty } from './plan-table';

function distanceLabel(km: number): string {
  if (km <= 5.1) return '5K';
  if (km <= 10.1) return '10K';
  if (km <= 21.5) return 'Half Marathon';
  if (km <= 42.5) return 'Marathon';
  return `${km}km`;
}

export default async function PlanPage() {
  const user = await requireUser();
  const plan = await getActivePlan(user.id);

  if (!plan) {
    return (
      <main className="p-8 max-w-5xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">Training Plan</h1>
        <PlanTableEmpty />
      </main>
    );
  }

  const raceLabel = distanceLabel(plan.race_distance_km);
  const raceName = plan.race_name ?? raceLabel;
  const raceDate = new Date(plan.race_date + 'T00:00:00Z').toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });

  return (
    <main className="p-4 md:p-8 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{raceName}</h1>
          <p className="text-slate-500 text-sm mt-1">
            {plan.total_weeks}-week plan · {raceLabel} · {raceDate}
            {plan.goal_time_seconds && (
              <> · Goal: {secondsToTimeString(plan.goal_time_seconds, { forceHours: true })}</>
            )}
          </p>
        </div>
        <div className="text-sm text-slate-500">
          {plan.sessions.length} sessions
        </div>
      </div>

      <PlanTable sessions={plan.sessions} totalWeeks={plan.total_weeks} />
    </main>
  );
}
