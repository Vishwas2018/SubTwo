import { notFound } from 'next/navigation';
import Link from 'next/link';
import { requireUser } from '@/lib/auth/session';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { secondsToTimeString } from '@/lib/pace-zones';
import { CommentsSection } from '@/app/(app)/session/[id]/comments-section';

const SESSION_LABELS: Record<string, string> = {
  easy: 'Easy Run',
  long_run: 'Long Run',
  threshold: 'Threshold',
  interval: 'Interval',
  marathon_pace: 'Marathon Pace',
  recovery: 'Recovery',
  race: 'Race',
  time_trial: 'Time Trial',
  rest: 'Rest Day',
};

const PHASE_COLORS: Record<string, string> = {
  base: 'bg-blue-100 text-blue-800',
  build: 'bg-orange-100 text-orange-800',
  peak: 'bg-red-100 text-red-800',
  taper: 'bg-green-100 text-green-800',
};

function formatPaceRange(minSec: number | null, maxSec: number | null): string {
  if (!minSec && !maxSec) return '—';
  if (minSec && maxSec) return `${secondsToTimeString(maxSec)}–${secondsToTimeString(minSec)} /km`;
  const s = minSec ?? maxSec!;
  return `${secondsToTimeString(s)} /km`;
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m.toString().padStart(2, '0')}m`;
  if (m > 0) return `${m}m ${s.toString().padStart(2, '0')}s`;
  return `${s}s`;
}

export default async function CoachSessionPage({
  params,
}: {
  params: Promise<{ athleteId: string; id: string }>;
}) {
  const { athleteId, id: sessionId } = await params;
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
    .select('display_name, email')
    .eq('id', athleteId)
    .single();

  if (!athlete) notFound();

  // Fetch session (viewer_read_access RLS allows this)
  const { data: session } = await supabase
    .from('planned_sessions')
    .select('*')
    .eq('id', sessionId)
    .maybeSingle();

  if (!session) notFound();

  // Verify session belongs to athlete's plan
  const { data: plan } = await supabase
    .from('plans')
    .select('id, race_name, race_date, race_distance_km, total_weeks, goal_time_seconds')
    .eq('id', session.plan_id)
    .eq('user_id', athleteId)
    .maybeSingle();

  if (!plan) notFound();

  // Linked run (viewer_read_access RLS allows this)
  const { data: linkedRun } = session.id
    ? await supabase
        .from('runs')
        .select(
          'id, run_date, distance_km, duration_seconds, avg_pace_seconds, avg_hr, rpe, felt_easy, notes',
        )
        .eq('planned_session_id', session.id)
        .eq('user_id', athleteId)
        .is('deleted_at', null)
        .maybeSingle()
    : { data: null };

  const sessionLabel = SESSION_LABELS[session.session_type] ?? session.session_type;
  const phaseColor = PHASE_COLORS[session.phase] ?? 'bg-slate-100 text-slate-700';
  const athleteName = athlete.display_name ?? athlete.email;

  const sessionDate = new Date(session.scheduled_date + 'T00:00:00Z').toLocaleDateString('en-AU', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });

  // Fetch initial comments if run exists
  let initialComments: { id: string; comment: string; created_at: string; author_id: string }[] =
    [];
  if (linkedRun) {
    const { data: comments } = await supabase
      .from('run_comments')
      .select('id, comment, created_at, author_id')
      .eq('run_id', linkedRun.id)
      .is('deleted_at', null)
      .order('created_at', { ascending: true });
    initialComments = comments ?? [];
  }

  return (
    <main className="min-h-screen">
      <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 text-sm text-amber-800 text-center">
        Viewing as coach · read-only
      </div>

      <div className="p-4 md:p-8 max-w-2xl mx-auto space-y-6">
        <Link
          href={`/coach/${athleteId}/plan`}
          className="text-sm text-slate-500 hover:text-slate-700 flex items-center gap-1"
        >
          ← Back to {athleteName}&apos;s plan
        </Link>

        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-bold text-slate-900">{sessionLabel}</h1>
            <span className={`px-2 py-0.5 rounded text-sm font-medium capitalize ${phaseColor}`}>
              {session.phase}
            </span>
          </div>
          <p className="text-slate-500 text-sm">
            Week {session.week_number} · {sessionDate}
          </p>
        </div>

        {/* Planned */}
        <section className="rounded-lg border border-slate-200 bg-white p-5 space-y-4">
          <h2 className="font-semibold text-slate-700 text-sm uppercase tracking-wide">Planned</h2>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
            {session.distance_km != null && (
              <>
                <dt className="text-slate-500">Distance</dt>
                <dd className="font-medium text-slate-800">{session.distance_km} km</dd>
              </>
            )}
            {(session.target_pace_min != null || session.target_pace_max != null) && (
              <>
                <dt className="text-slate-500">Target pace</dt>
                <dd className="font-medium text-slate-800 font-mono">
                  {formatPaceRange(session.target_pace_min, session.target_pace_max)}
                </dd>
              </>
            )}
            <dt className="text-slate-500">Type</dt>
            <dd className="font-medium text-slate-800">{sessionLabel}</dd>
          </dl>
          {session.focus && (
            <div className="space-y-1">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Focus</p>
              <p className="text-sm text-slate-700">{session.focus}</p>
            </div>
          )}
          {session.structure && (
            <div className="space-y-1">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                Structure
              </p>
              <p className="text-sm text-slate-700 font-mono whitespace-pre-wrap">
                {session.structure}
              </p>
            </div>
          )}
        </section>

        {/* Actual */}
        <section className="rounded-lg border border-slate-200 bg-white p-5 space-y-4">
          <h2 className="font-semibold text-slate-700 text-sm uppercase tracking-wide">Actual</h2>
          {linkedRun ? (
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
              <dt className="text-slate-500">Distance</dt>
              <dd className="font-medium text-slate-800">{linkedRun.distance_km} km</dd>
              <dt className="text-slate-500">Duration</dt>
              <dd className="font-medium text-slate-800">
                {formatDuration(linkedRun.duration_seconds)}
              </dd>
              {linkedRun.avg_pace_seconds && (
                <>
                  <dt className="text-slate-500">Avg pace</dt>
                  <dd className="font-medium text-slate-800 font-mono">
                    {secondsToTimeString(linkedRun.avg_pace_seconds)} /km
                  </dd>
                </>
              )}
              {linkedRun.avg_hr && (
                <>
                  <dt className="text-slate-500">Avg HR</dt>
                  <dd className="font-medium text-slate-800">{linkedRun.avg_hr} bpm</dd>
                </>
              )}
              {linkedRun.rpe != null && (
                <>
                  <dt className="text-slate-500">RPE</dt>
                  <dd className="font-medium text-slate-800">{linkedRun.rpe}/10</dd>
                </>
              )}
              {linkedRun.felt_easy != null && (
                <>
                  <dt className="text-slate-500">Felt easy?</dt>
                  <dd className="font-medium text-slate-800">
                    {linkedRun.felt_easy ? 'Yes' : 'No'}
                  </dd>
                </>
              )}
              {linkedRun.notes && (
                <>
                  <dt className="text-slate-500">Notes</dt>
                  <dd className="text-slate-700">{linkedRun.notes}</dd>
                </>
              )}
            </dl>
          ) : (
            <p className="text-slate-400 text-sm">No run logged yet.</p>
          )}
        </section>

        {/* Comments */}
        {linkedRun && (
          <CommentsSection
            runId={linkedRun.id}
            initialComments={initialComments}
            currentUserId={user.id}
            canComment={access.can_comment}
          />
        )}
      </div>
    </main>
  );
}
