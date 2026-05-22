import Link from 'next/link';
import { requireUser } from '@/lib/auth/session';
import { getActivePlan } from '@/lib/plans/queries';
import { LogForm } from './log-form';

const SESSION_LABELS: Record<string, string> = {
  easy: 'Easy Run',
  long_run: 'Long Run',
  threshold: 'Threshold',
  interval: 'Interval',
  marathon_pace: 'Marathon Pace',
  recovery: 'Recovery',
  race: 'Race',
  time_trial: 'Time Trial',
};

function todayIso(): string {
  return new Date().toISOString().split('T')[0]!;
}

export default async function LogPage({
  searchParams,
}: {
  searchParams: Promise<{ session?: string }>;
}) {
  const { session: sessionParam } = await searchParams;
  const user = await requireUser();
  const plan = await getActivePlan(user.id);

  const sessions = (plan?.sessions ?? [])
    .filter((s) => s.session_type !== 'rest')
    .map((s) => ({
      id: s.id,
      label: SESSION_LABELS[s.session_type] ?? s.session_type,
      scheduled_date: s.scheduled_date,
    }));

  // Prefill date from linked session if available
  const linkedSession = sessions.find((s) => s.id === sessionParam);
  const defaultDate = linkedSession?.scheduled_date ?? todayIso();
  const defaultSessionId = linkedSession?.id ?? null;

  return (
    <main className="p-4 md:p-8 max-w-xl mx-auto space-y-6">
      <Link href={defaultSessionId ? `/session/${defaultSessionId}` : '/plan'}
        className="text-sm text-slate-500 hover:text-slate-700 flex items-center gap-1">
        ← {defaultSessionId ? 'Back to Session' : 'Back to Plan'}
      </Link>

      <div>
        <h1 className="text-2xl font-bold text-slate-900">Log a Run</h1>
        {defaultSessionId && (
          <p className="text-sm text-slate-500 mt-1">
            Logging for: {linkedSession?.scheduled_date} · {linkedSession?.label}
          </p>
        )}
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-6">
        <LogForm
          defaultDate={defaultDate}
          defaultSessionId={defaultSessionId}
          sessions={sessions}
        />
      </div>
    </main>
  );
}
