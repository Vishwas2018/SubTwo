'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { GeneratedPlan } from '@/lib/schemas/plan';

// ─── Types ────────────────────────────────────────────────────────────────────

type PlanData = {
  id: string;
  status: string;
  race_distance_km: number;
  race_name: string | null;
  race_date: string;
  total_weeks: number;
  experience_level: string;
  goal_time_seconds: number | null;
  version_id: string;
  version_number: number;
  generated_plan: GeneratedPlan;
  quota: { allowed: boolean; lifetime_remaining: number; daily_remaining: number };
};

// ─── Formatters ───────────────────────────────────────────────────────────────

function secToTime(s: number): string {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}

function secPerKmToStr(s: number): string {
  const m = Math.floor(s / 60);
  const sec = Math.round(s % 60);
  return `${m}:${String(sec).padStart(2, '0')} /km`;
}

function distanceLabel(km: number): string {
  if (km === 5) return '5K';
  if (km === 10) return '10K';
  if (km === 21.1 || km === 21.0975) return 'Half Marathon';
  if (km === 42.195 || km === 42.2) return 'Marathon';
  return `${km} km`;
}

const PHASE_COLORS: Record<string, string> = {
  base: 'bg-blue-400',
  build: 'bg-orange-400',
  peak: 'bg-red-500',
  taper: 'bg-emerald-400',
};

const ZONE_LABELS: Record<string, string> = {
  recovery: 'Recovery',
  easy: 'Easy',
  long_run: 'Long Run',
  marathon_pace: 'Marathon Pace',
  race_pace: 'Race Pace',
  threshold: 'Threshold',
  interval: 'Interval',
};

const SESSION_LABELS: Record<string, string> = {
  rest: 'Rest',
  easy: 'Easy',
  easy_strides: 'Easy + Strides',
  long_run: 'Long Run',
  threshold: 'Threshold',
  interval: 'Intervals',
  tempo: 'Tempo',
  race_pace: 'Race Pace',
  time_trial: 'Time Trial',
  strength: 'Strength',
  race: 'Race',
  recovery: 'Recovery',
  marathon_pace: 'Marathon Pace',
};

// ─── Main component ───────────────────────────────────────────────────────────

export function ReviewContent() {
  const params = useSearchParams();
  const router = useRouter();
  const planId = params.get('plan');

  const [plan, setPlan] = useState<PlanData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [accepting, setAccepting] = useState(false);
  const [acceptError, setAcceptError] = useState<string | null>(null);

  const [regenOpen, setRegenOpen] = useState(false);
  const [regenReason, setRegenReason] = useState('');
  const [regenerating, setRegenerating] = useState(false);
  const [regenError, setRegenError] = useState<string | null>(null);

  const [showFullPlan, setShowFullPlan] = useState(false);

  // Fetch plan data
  useEffect(() => {
    if (!planId) return;
    async function load() {
      try {
        const res = await fetch(`/api/plans/${planId}`);
        const json = await res.json() as { data?: PlanData; error?: { message: string } };
        if (!res.ok) {
          setError(json.error?.message ?? 'Failed to load plan.');
        } else {
          setPlan(json.data!);
        }
      } catch {
        setError('Network error loading plan.');
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [planId]);

  async function handleAccept() {
    if (!plan) return;
    setAccepting(true);
    setAcceptError(null);
    try {
      const res = await fetch(`/api/plans/${plan.id}/activate`, { method: 'POST' });
      if (res.ok) {
        router.push('/dashboard');
        return;
      }
      const json = await res.json() as { error?: { message: string } };
      setAcceptError(json.error?.message ?? 'Failed to activate plan.');
    } catch {
      setAcceptError('Network error. Try again.');
    } finally {
      setAccepting(false);
    }
  }

  async function handleRegenerate() {
    if (!plan) return;
    setRegenerating(true);
    setRegenError(null);
    try {
      const res = await fetch(`/api/plans/${plan.id}/regenerate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: regenReason }),
      });
      const json = await res.json() as { error?: { code?: string; message: string } };
      if (!res.ok) {
        const msg = json.error?.code === 'quota_exhausted'
          ? 'quota: ' + (json.error.message ?? 'Quota exceeded.')
          : (json.error?.message ?? 'Regeneration failed.');
        setRegenError(msg);
        return;
      }
      // Success: re-fetch the plan (new version loaded)
      setRegenOpen(false);
      setRegenReason('');
      setLoading(true);
      const planRes = await fetch(`/api/plans/${plan.id}`);
      const planJson = await planRes.json() as { data?: PlanData };
      if (planRes.ok && planJson.data) {
        setPlan(planJson.data);
      }
      setLoading(false);
    } catch {
      setRegenError('Network error. Try again.');
    } finally {
      setRegenerating(false);
    }
  }

  // ─── Render states ────────────────────────────────────────────────────────

  if (!planId) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
        <p className="text-slate-500 text-sm">No plan ID provided.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-slate-500 text-sm">Loading your plan…</p>
        </div>
      </div>
    );
  }

  if (error || !plan) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
        <Card className="w-full max-w-md shadow-sm">
          <CardContent className="pt-6">
            <p className="text-red-600 text-sm">{error ?? 'Plan not found.'}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const gp = plan.generated_plan;
  const weeks = gp.weeks;
  const maxKm = Math.max(...weeks.map((w) => w.total_km), 1);
  const zones = Object.entries(gp.pace_zones) as [string, GeneratedPlan['pace_zones']['easy']][];

  return (
    <div className="min-h-screen bg-slate-50 pb-16">
      <div className="max-w-2xl mx-auto pt-8 px-4 space-y-5">

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Your training plan</h1>
          <p className="text-slate-500 text-sm mt-1">
            {distanceLabel(plan.race_distance_km)}
            {plan.race_name ? ` · ${plan.race_name}` : ''}
            {' · '}{plan.total_weeks} weeks
            {' · '}{plan.race_date}
            {plan.goal_time_seconds
              ? ` · Goal: ${secToTime(plan.goal_time_seconds)}`
              : ''}
          </p>
          <div className="mt-1 flex items-center gap-2">
            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-200 text-slate-600 capitalize">
              {plan.experience_level}
            </span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
              v{plan.version_number}
            </span>
          </div>
        </div>

        {/* ── Coaching philosophy ─────────────────────────────────────────── */}
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Coaching approach</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-slate-600 leading-relaxed">{gp.summary.philosophy}</p>
            <p className="text-sm text-slate-500 leading-relaxed mt-3">{gp.summary.weekly_pattern}</p>
          </CardContent>
        </Card>

        {/* ── Pace zones ──────────────────────────────────────────────────── */}
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Pace zones</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-slate-400 text-xs uppercase border-b border-slate-100">
                    <th className="text-left py-1 font-medium">Zone</th>
                    <th className="text-right py-1 font-medium">Slow end</th>
                    <th className="text-right py-1 font-medium">Fast end</th>
                    <th className="text-right py-1 font-medium">RPE</th>
                  </tr>
                </thead>
                <tbody>
                  {zones.map(([name, zone]) => (
                    <tr key={name} className="border-b border-slate-50 last:border-0">
                      <td className="py-1.5 text-slate-700 font-medium">
                        {ZONE_LABELS[name] ?? name}
                      </td>
                      <td className="py-1.5 text-right text-slate-500 tabular-nums">
                        {secPerKmToStr(zone.min_seconds_per_km)}
                      </td>
                      <td className="py-1.5 text-right text-slate-500 tabular-nums">
                        {secPerKmToStr(zone.max_seconds_per_km)}
                      </td>
                      <td className="py-1.5 text-right text-slate-400">
                        {zone.rpe_min}–{zone.rpe_max}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* ── Checkpoints ─────────────────────────────────────────────────── */}
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Checkpoints</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {gp.checkpoints.map((cp, i) => (
                <li key={i} className="flex items-start gap-3 text-sm">
                  <span className="mt-0.5 w-6 h-6 flex items-center justify-center rounded-full bg-emerald-100 text-emerald-700 font-semibold text-xs shrink-0">
                    {i + 1}
                  </span>
                  <div>
                    <span className="text-slate-700 font-medium">Week {cp.week}</span>
                    <span className="text-slate-400 mx-1">·</span>
                    <span className="text-slate-600 capitalize">{cp.type.replace(/_/g, ' ')}</span>
                    <span className="text-slate-400 mx-1">·</span>
                    <span className="text-slate-500">
                      Target {secToTime(cp.target_seconds)} over {cp.target_distance_km} km
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        {/* ── Weekly volume arc ────────────────────────────────────────────── */}
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Weekly volume</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1" aria-label="Weekly volume chart">
              {weeks.map((w) => {
                const pct = Math.round((w.total_km / maxKm) * 100);
                const phase = (w.phase ?? 'base').toLowerCase();
                const color = PHASE_COLORS[phase] ?? 'bg-slate-400';
                return (
                  <div key={w.week_number} className="flex items-center gap-2 text-xs">
                    <span className="w-8 text-right text-slate-400 shrink-0">
                      W{w.week_number}
                    </span>
                    <div className="flex-1 bg-slate-100 rounded-full h-3">
                      <div
                        className={`${color} h-3 rounded-full`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="w-10 text-slate-500 tabular-nums">{w.total_km} km</span>
                  </div>
                );
              })}
            </div>
            <div className="flex gap-4 mt-3 text-xs text-slate-400">
              {Object.entries(PHASE_COLORS).map(([phase, color]) => (
                <span key={phase} className="flex items-center gap-1 capitalize">
                  <span className={`w-2.5 h-2.5 rounded-full ${color}`} />
                  {phase}
                </span>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* ── Full plan preview ────────────────────────────────────────────── */}
        <div>
          <button
            onClick={() => setShowFullPlan((v) => !v)}
            className="text-sm text-emerald-600 hover:text-emerald-700 font-medium"
            aria-expanded={showFullPlan}
          >
            {showFullPlan ? '▲ Hide full plan' : '▼ Preview full plan'}
          </button>

          {showFullPlan && (
            <div className="mt-3 overflow-x-auto rounded-lg border border-slate-200 bg-white">
              <table className="w-full text-xs">
                <thead className="bg-slate-50">
                  <tr className="text-slate-400 uppercase">
                    <th className="text-left px-3 py-2 font-medium">Wk</th>
                    <th className="text-left px-3 py-2 font-medium">Phase</th>
                    <th className="text-left px-3 py-2 font-medium">Day</th>
                    <th className="text-left px-3 py-2 font-medium">Type</th>
                    <th className="text-right px-3 py-2 font-medium">km</th>
                    <th className="text-right px-3 py-2 font-medium">Pace</th>
                  </tr>
                </thead>
                <tbody>
                  {weeks.flatMap((w) =>
                    w.sessions.map((s) => (
                      <tr
                        key={`${w.week_number}-${s.day_of_week}`}
                        className="border-t border-slate-100"
                      >
                        <td className="px-3 py-1.5 text-slate-400">{w.week_number}</td>
                        <td className="px-3 py-1.5 text-slate-400 capitalize">{w.phase ?? '—'}</td>
                        <td className="px-3 py-1.5 text-slate-400">{s.day_of_week}</td>
                        <td className="px-3 py-1.5 text-slate-700">
                          {SESSION_LABELS[s.session_type] ?? s.session_type}
                        </td>
                        <td className="px-3 py-1.5 text-right text-slate-500">
                          {s.distance_km != null ? s.distance_km : '—'}
                        </td>
                        <td className="px-3 py-1.5 text-right text-slate-400 tabular-nums">
                          {s.target_pace_seconds_per_km != null
                            ? secPerKmToStr(s.target_pace_seconds_per_km)
                            : '—'}
                        </td>
                      </tr>
                    )),
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ── Error states ─────────────────────────────────────────────────── */}
        {acceptError && (
          <p role="alert" className="text-sm text-red-600">{acceptError}</p>
        )}

        {/* ── Action buttons ───────────────────────────────────────────────── */}
        <div className="flex gap-3 pt-2">
          <Button
            variant="outline"
            onClick={() => {
              setRegenOpen(true);
              setRegenError(null);
            }}
            disabled={!plan.quota.allowed || regenerating}
            className="flex-1"
            aria-label="Regenerate plan"
          >
            ↺ Regenerate
          </Button>
          <Button
            onClick={() => { void handleAccept(); }}
            disabled={accepting}
            className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
            aria-label="Accept plan and start training"
          >
            {accepting ? 'Activating…' : 'Accept & Start →'}
          </Button>
        </div>

        {!plan.quota.allowed && (
          <p className="text-xs text-slate-400 text-center">
            Regeneration quota exhausted. You can still accept this plan.
          </p>
        )}

      </div>

      {/* ── Regenerate modal ──────────────────────────────────────────────── */}
      {regenOpen && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center px-4 z-50"
          role="dialog"
          aria-modal="true"
          aria-label="Regenerate plan"
        >
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 space-y-4">
            <h2 className="text-lg font-semibold text-slate-900">Regenerate plan</h2>

            <div className="text-sm text-slate-500 space-y-1">
              <p>
                Daily remaining:{' '}
                <span className="font-medium text-slate-700">{plan.quota.daily_remaining}</span>
              </p>
              <p>
                Lifetime remaining:{' '}
                <span className="font-medium text-slate-700">{plan.quota.lifetime_remaining}</span>
              </p>
            </div>

            <div>
              <label htmlFor="regen-reason" className="text-sm font-medium text-slate-700 block mb-1">
                Reason{' '}
                <span className="text-slate-400 font-normal">(optional)</span>
              </label>
              <textarea
                id="regen-reason"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500"
                rows={3}
                placeholder="e.g. Reduce volume in weeks 1-3, more deload weeks"
                value={regenReason}
                onChange={(e) => setRegenReason(e.target.value)}
                maxLength={500}
              />
            </div>

            {regenError && (
              <p role="alert" className="text-sm text-red-600">{regenError}</p>
            )}

            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => { setRegenOpen(false); setRegenError(null); }}
                disabled={regenerating}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={() => { void handleRegenerate(); }}
                disabled={regenerating}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                {regenerating ? 'Generating…' : 'Regenerate'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
