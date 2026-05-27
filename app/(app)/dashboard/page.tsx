import Link from 'next/link';
import { requireUser } from '@/lib/auth/session';
import { getDashboardData } from '@/lib/dashboard/queries';
import { melbourneToday } from '@/lib/plans/view-helpers';
import { SESSION_ABBREV } from '@/lib/plans/view-helpers';
import type { DashboardData } from '@/lib/dashboard/queries';

// ─── helpers ──────────────────────────────────────────────────────────────────

function fmtPace(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function pct(completed: number, planned: number): number {
  if (planned === 0) return 0;
  return Math.min(100, Math.round((completed / planned) * 100));
}

const SESSION_LABELS: Record<string, string> = {
  easy: 'Easy Run',
  long_run: 'Long Run',
  threshold: 'Threshold',
  interval: 'Intervals',
  marathon_pace: 'Marathon Pace',
  race_pace: 'Race Pace',
  recovery: 'Recovery',
  time_trial: 'Time Trial',
  race: 'Race',
};

const PHASE_LABEL: Record<string, string> = {
  base: 'Base',
  build: 'Build',
  peak: 'Peak',
  taper: 'Taper',
};

const VERDICT_COLORS: Record<string, string> = {
  green: 'bg-emerald-500',
  amber: 'bg-amber-500',
  red: 'bg-red-500',
};

const VERDICT_TEXT: Record<string, string> = {
  green: 'On Track',
  amber: 'Slightly Behind',
  red: 'Significantly Behind',
};

// ─── sub-components ───────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <main className="flex min-h-[60vh] flex-col items-center justify-center p-8 text-center">
      <div className="max-w-sm space-y-4">
        <div className="text-4xl">🏃</div>
        <h1 className="text-2xl font-bold text-slate-900">No active training plan</h1>
        <p className="text-slate-500">
          Complete the wizard to generate your personalised marathon training plan.
        </p>
        <Link
          href="/onboarding/wizard"
          className="inline-flex items-center rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 transition-colors"
        >
          Start Wizard
        </Link>
      </div>
    </main>
  );
}

function TodayCard({ data }: { data: DashboardData }) {
  const { next_session } = data;

  if (!next_session) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-5 text-center">
        <p className="text-slate-500 text-sm">No upcoming sessions — great work this week!</p>
      </div>
    );
  }

  const label = SESSION_LABELS[next_session.session_type] ?? next_session.session_type;
  const abbrev = SESSION_ABBREV[next_session.session_type] ?? '?';

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-0.5">
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">
            {next_session.scheduled_date === melbourneToday() ? "Today's Session" : 'Next Session'}
          </p>
          <p className="text-lg font-bold text-slate-900">{label}</p>
          {next_session.focus && (
            <p className="text-sm text-slate-500">{next_session.focus}</p>
          )}
        </div>
        <div className="shrink-0 h-12 w-12 rounded-lg bg-emerald-100 flex items-center justify-center">
          <span className="text-emerald-700 font-bold text-sm">{abbrev}</span>
        </div>
      </div>

      <div className="flex items-center gap-4 text-sm text-slate-600">
        {next_session.distance_km && (
          <span className="font-semibold">{next_session.distance_km} km</span>
        )}
        <span className="text-slate-400">{next_session.scheduled_date}</span>
        <span className="text-slate-400 capitalize">{PHASE_LABEL[next_session.phase] ?? next_session.phase}</span>
      </div>

      <div className="flex gap-2 pt-1">
        <Link
          href={`/session/${next_session.id}`}
          className="flex-1 text-center rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 transition-colors"
        >
          View Session
        </Link>
        <Link
          href={`/log?session=${next_session.id}`}
          className="flex-1 text-center rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
        >
          Log Run
        </Link>
      </div>
    </div>
  );
}

function WeekProgress({ data }: { data: DashboardData }) {
  const { current_week } = data;
  if (!current_week) return null;

  const done = pct(current_week.sessions_completed, current_week.sessions_planned);
  const kmDone = pct(current_week.completed_km, current_week.planned_km);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">
            Week {current_week.week_number} · {PHASE_LABEL[current_week.phase] ?? current_week.phase}
          </p>
        </div>
        <p className="text-sm text-slate-500">
          {current_week.sessions_completed}/{current_week.sessions_planned} sessions
        </p>
      </div>

      {/* Sessions progress bar */}
      <div className="space-y-1.5">
        <div className="flex justify-between text-xs text-slate-500">
          <span>Sessions</span>
          <span>{done}%</span>
        </div>
        <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
          <div
            className="h-full rounded-full bg-emerald-500 transition-all"
            style={{ width: `${done}%` }}
          />
        </div>
      </div>

      {/* km progress bar */}
      <div className="space-y-1.5">
        <div className="flex justify-between text-xs text-slate-500">
          <span>Volume</span>
          <span>{current_week.completed_km} / {current_week.planned_km} km</span>
        </div>
        <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
          <div
            className="h-full rounded-full bg-blue-500 transition-all"
            style={{ width: `${kmDone}%` }}
          />
        </div>
      </div>
    </div>
  );
}

function AlertsPanel({ alerts }: { alerts: DashboardData['alerts'] }) {
  if (alerts.length === 0) return null;
  return (
    <div className="space-y-2">
      {alerts.map((alert, i) => (
        <div
          key={i}
          className="rounded-lg bg-amber-50 border border-amber-300 px-4 py-3 text-sm text-amber-800"
        >
          <span className="font-semibold">Heads up: </span>
          {alert.message}
        </div>
      ))}
    </div>
  );
}

function ReadinessCard({ readiness }: { data: DashboardData; readiness: DashboardData['readiness'] }) {
  if (!readiness.last_verdict) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-5">
        <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-2">Readiness</p>
        <p className="text-sm text-slate-500">No checkpoint logged yet.</p>
        <Link href="/checkpoints" className="mt-2 text-sm text-emerald-600 font-medium hover:underline">
          View Checkpoints →
        </Link>
      </div>
    );
  }

  const color = VERDICT_COLORS[readiness.last_verdict] ?? 'bg-slate-400';
  const label = VERDICT_TEXT[readiness.last_verdict] ?? readiness.last_verdict;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
      <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">Readiness</p>
      <div className="flex items-center gap-3">
        <div className={`h-4 w-4 rounded-full ${color}`} />
        <div>
          <p className="font-semibold text-slate-900">{label}</p>
          {readiness.last_checkpoint_type && (
            <p className="text-xs text-slate-500">Last checkpoint: {readiness.last_checkpoint_type}</p>
          )}
        </div>
      </div>
      <Link href="/checkpoints" className="text-sm text-emerald-600 font-medium hover:underline">
        View Checkpoints →
      </Link>
    </div>
  );
}

function TrendBar({ value, max, colorClass }: { value: number; max: number; colorClass: string }) {
  const w = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div className="flex-1 flex flex-col items-center gap-1">
      <div className="w-full flex flex-col justify-end" style={{ height: 40 }}>
        <div
          className={`w-full rounded-sm ${colorClass}`}
          style={{ height: `${w}%`, minHeight: w > 0 ? 2 : 0 }}
        />
      </div>
    </div>
  );
}

function Trends4w({ trends }: { trends: DashboardData['trends_4w'] }) {
  const kmMax = Math.max(...trends.weekly_km, 1);
  const paceVals = trends.avg_easy_pace.filter((v): v is number => v !== null);
  const paceMax = paceVals.length ? Math.max(...paceVals) : 0;
  const sleepVals = trends.avg_sleep.filter((v): v is number => v !== null);
  const sleepMax = sleepVals.length ? Math.max(...sleepVals, 9) : 9;
  const rhrVals = trends.avg_rhr.filter((v): v is number => v !== null);
  const rhrMax = rhrVals.length ? Math.max(...rhrVals) : 0;

  const weeks = ['W-3', 'W-2', 'W-1', 'Now'];

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-5">
      <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">4-Week Trends</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Volume */}
        <div>
          <p className="text-xs text-slate-500 mb-2">Weekly km</p>
          <div className="flex gap-1 items-end h-10">
            {trends.weekly_km.map((km, i) => (
              <TrendBar key={i} value={km} max={kmMax} colorClass="bg-emerald-400" />
            ))}
          </div>
          <div className="flex gap-1 mt-1">
            {weeks.map((w, i) => (
              <p key={i} className="flex-1 text-center text-xs text-slate-400">{w}</p>
            ))}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {trends.weekly_km.map((k) => Math.round(k)).join(' · ')} km
          </p>
        </div>

        {/* Easy pace */}
        <div>
          <p className="text-xs text-slate-500 mb-2">Avg easy pace</p>
          <div className="flex gap-1 items-end h-10">
            {trends.avg_easy_pace.map((p, i) => (
              <TrendBar key={i} value={p ?? 0} max={paceMax} colorClass="bg-blue-400" />
            ))}
          </div>
          <div className="flex gap-1 mt-1">
            {weeks.map((w, i) => (
              <p key={i} className="flex-1 text-center text-xs text-slate-400">{w}</p>
            ))}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {trends.avg_easy_pace.map((p) => (p ? fmtPace(p) : '—')).join(' · ')} /km
          </p>
        </div>

        {/* Sleep */}
        <div>
          <p className="text-xs text-slate-500 mb-2">Avg sleep (h)</p>
          <div className="flex gap-1 items-end h-10">
            {trends.avg_sleep.map((s, i) => (
              <TrendBar key={i} value={s ?? 0} max={sleepMax} colorClass="bg-violet-400" />
            ))}
          </div>
          <div className="flex gap-1 mt-1">
            {weeks.map((w, i) => (
              <p key={i} className="flex-1 text-center text-xs text-slate-400">{w}</p>
            ))}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {trends.avg_sleep.map((s) => (s !== null ? s.toFixed(1) : '—')).join(' · ')}h
          </p>
        </div>

        {/* RHR */}
        <div>
          <p className="text-xs text-slate-500 mb-2">Avg RHR (bpm)</p>
          <div className="flex gap-1 items-end h-10">
            {trends.avg_rhr.map((r, i) => (
              <TrendBar key={i} value={r ?? 0} max={rhrMax} colorClass="bg-rose-400" />
            ))}
          </div>
          <div className="flex gap-1 mt-1">
            {weeks.map((w, i) => (
              <p key={i} className="flex-1 text-center text-xs text-slate-400">{w}</p>
            ))}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {trends.avg_rhr.map((r) => (r !== null ? r : '—')).join(' · ')} bpm
          </p>
        </div>
      </div>
    </div>
  );
}

function NigglesIndicator({ count }: { count: number }) {
  if (count === 0) return null;
  return (
    <div className="flex items-center justify-between rounded-lg bg-red-50 border border-red-200 px-4 py-3">
      <p className="text-sm text-red-800">
        <span className="font-semibold">{count} active niggle{count !== 1 ? 's' : ''}</span> — monitor closely
      </p>
      <Link href="/niggles" className="text-sm text-red-700 font-medium hover:underline">
        View →
      </Link>
    </div>
  );
}

// ─── page ─────────────────────────────────────────────────────────────────────

export default async function DashboardPage() {
  const user = await requireUser();
  const data = await getDashboardData(user.id);

  if (!data) return <EmptyState />;

  const today = melbourneToday();
  const dateLabel = new Date(today + 'T00:00:00Z').toLocaleDateString('en-AU', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  });

  return (
    <main className="p-4 md:p-8 max-w-2xl mx-auto space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
        <p className="text-sm text-slate-500 mt-0.5">{dateLabel}</p>
      </div>

      {/* Alerts */}
      <AlertsPanel alerts={data.alerts} />

      {/* Today */}
      <TodayCard data={data} />

      {/* Week progress */}
      <WeekProgress data={data} />

      {/* Niggles */}
      <NigglesIndicator count={data.active_niggles_count} />

      {/* Readiness */}
      <ReadinessCard data={data} readiness={data.readiness} />

      {/* 4-week trends */}
      <Trends4w trends={data.trends_4w} />

      {/* Quick nav */}
      <nav className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {[
          { href: '/plan', label: 'Training Plan' },
          { href: '/log', label: 'Log Run' },
          { href: '/check-in', label: 'Check-In' },
          { href: '/checkpoints', label: 'Checkpoints' },
        ].map(({ href, label }) => (
          <Link
            key={href}
            href={href}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-center text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
          >
            {label}
          </Link>
        ))}
      </nav>
    </main>
  );
}
