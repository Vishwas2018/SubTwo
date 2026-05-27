'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { PlannedSession } from '@/lib/plans/queries';
import { groupSessionsByWeek, cellState, SESSION_ABBREV, melbourneToday } from '@/lib/plans/view-helpers';
import { secondsToTimeString } from '@/lib/pace-zones';

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const DAYS = [1, 2, 3, 4, 5, 6, 7];

const PHASE_COLORS: Record<string, string> = {
  base: 'bg-amber-50 text-amber-700',
  build: 'bg-orange-100 text-orange-700',
  peak: 'bg-red-100 text-red-700',
  taper: 'bg-teal-50 text-teal-700',
};

const CELL_COLORS: Record<string, string> = {
  completed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  today: 'bg-sky-100 text-sky-800 border-sky-400 ring-2 ring-sky-400',
  missed: 'bg-red-50 text-red-600 border-red-200',
  future: 'bg-stone-50 text-stone-600 border-stone-200',
  rest: 'bg-stone-50 text-stone-500 border-stone-100',
};

type Phase = 'all' | 'base' | 'build' | 'peak' | 'taper';

type Props = {
  sessions: PlannedSession[];
  totalWeeks: number;
  baseSessionHref?: string;
};

export function PlanTable({ sessions, totalWeeks, baseSessionHref = '/session' }: Props) {
  const today = melbourneToday();
  const [phase, setPhase] = useState<Phase>('all');

  const byWeek = groupSessionsByWeek(sessions);

  const weekNumbers = Array.from({ length: totalWeeks }, (_, i) => i + 1);

  // Detect current week number (first week where any session is today or future)
  const currentWeek = (() => {
    for (const w of weekNumbers) {
      const weekSessions = byWeek.get(w) ?? [];
      if (weekSessions.some((s) => s.scheduled_date >= today)) return w;
    }
    return null;
  })();

  // Get phase for a week (from first non-rest session)
  const weekPhase = (wn: number) => {
    const sess = byWeek.get(wn) ?? [];
    return sess.find((s) => s.session_type !== 'rest')?.phase ?? 'base';
  };

  const filteredWeeks = weekNumbers.filter(
    (wn) => phase === 'all' || weekPhase(wn) === phase,
  );

  return (
    <div className="space-y-4">
      {/* Phase filter tabs */}
      <div className="flex gap-2 flex-wrap">
        {(['all', 'base', 'build', 'peak', 'taper'] as Phase[]).map((p) => (
          <button
            key={p}
            onClick={() => setPhase(p)}
            className={`px-3 py-1 rounded-full text-sm font-medium capitalize border transition-colors ${
              phase === p
                ? 'bg-slate-900 text-white border-slate-900'
                : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'
            }`}
          >
            {p}
          </button>
        ))}
      </div>

      {/* Desktop table */}
      <div className="hidden md:block overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="px-3 py-2 text-left font-medium text-slate-500 w-20">Week</th>
              <th className="px-2 py-2 text-left font-medium text-slate-500 w-16">Phase</th>
              {DAY_LABELS.map((d) => (
                <th key={d} className="px-2 py-2 text-center font-medium text-slate-500 w-20">
                  {d}
                </th>
              ))}
              <th className="px-3 py-2 text-right font-medium text-slate-500 w-16">km</th>
            </tr>
          </thead>
          <tbody>
            {filteredWeeks.map((wn) => {
              const weekSessions = byWeek.get(wn) ?? [];
              const sessionByDay = new Map(weekSessions.map((s) => [s.day_of_week, s]));
              const totalKm = weekSessions.reduce((sum, s) => sum + (s.distance_km ?? 0), 0);
              const ph = weekPhase(wn);
              const isCurrent = wn === currentWeek;

              return (
                <tr
                  key={wn}
                  className={`border-b border-slate-100 last:border-0 ${isCurrent ? 'bg-blue-50/40' : 'hover:bg-slate-50/50'}`}
                >
                  <td className="px-3 py-2 font-medium text-slate-700">
                    <span className={isCurrent ? 'font-bold text-blue-700' : ''}>
                      W{wn}
                      {isCurrent && (
                        <span className="ml-1 text-xs text-blue-600">← now</span>
                      )}
                    </span>
                  </td>
                  <td className="px-2 py-2">
                    <span
                      className={`px-2 py-0.5 rounded text-xs font-medium capitalize ${PHASE_COLORS[ph] ?? ''}`}
                    >
                      {ph}
                    </span>
                  </td>
                  {DAYS.map((d) => {
                    const s = sessionByDay.get(d);
                    if (!s) {
                      return (
                        <td key={d} className="px-2 py-2 text-center text-slate-300">—</td>
                      );
                    }
                    const state = cellState(s, null, today);
                    return (
                      <td key={d} className="px-1 py-1.5">
                        <Link
                          href={`${baseSessionHref}/${s.id}`}
                          className={`block rounded border text-center px-1 py-1 text-xs font-medium transition-opacity hover:opacity-80 ${CELL_COLORS[state]}`}
                          title={`${s.session_type}${s.distance_km ? ` · ${s.distance_km}km` : ''}`}
                        >
                          <span className="block">{SESSION_ABBREV[s.session_type] ?? s.session_type}</span>
                          {s.distance_km && (
                            <span className="block text-[10px] opacity-75">{s.distance_km}k</span>
                          )}
                        </Link>
                      </td>
                    );
                  })}
                  <td className="px-3 py-2 text-right font-mono text-slate-600">
                    {totalKm > 0 ? totalKm.toFixed(0) : '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-3">
        {filteredWeeks.map((wn) => {
          const weekSessions = byWeek.get(wn) ?? [];
          const ph = weekPhase(wn);
          const isCurrent = wn === currentWeek;
          const totalKm = weekSessions.reduce((sum, s) => sum + (s.distance_km ?? 0), 0);

          return (
            <div
              key={wn}
              className={`rounded-lg border p-3 space-y-2 ${isCurrent ? 'border-blue-300 bg-blue-50/40' : 'border-slate-200 bg-white'}`}
            >
              <div className="flex items-center justify-between">
                <span className={`font-semibold ${isCurrent ? 'text-blue-700' : 'text-slate-700'}`}>
                  Week {wn}{isCurrent && ' · Current'}
                </span>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium capitalize ${PHASE_COLORS[ph] ?? ''}`}>
                    {ph}
                  </span>
                  <span className="text-xs text-slate-500">{totalKm > 0 ? `${totalKm.toFixed(0)} km` : ''}</span>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {weekSessions.map((s) => {
                  const state = cellState(s, null, today);
                  return (
                    <Link
                      key={s.id}
                      href={`${baseSessionHref}/${s.id}`}
                      className={`rounded border px-2 py-1 text-xs font-medium ${CELL_COLORS[state]}`}
                    >
                      {DAY_LABELS[(s.day_of_week - 1) % 7]} · {SESSION_ABBREV[s.session_type] ?? s.session_type}
                      {s.distance_km ? ` ${s.distance_km}k` : ''}
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 text-xs text-slate-500 pt-2 border-t border-slate-100">
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded bg-emerald-100 border border-emerald-200" /> Completed
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded bg-sky-200 border border-sky-400" /> Today
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded bg-red-100 border border-red-200" /> Missed
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded bg-stone-100 border border-stone-200" /> Planned
        </span>
        <span className="flex items-center gap-1 ml-2 text-slate-400">
          E=Easy · L=Long · T=Threshold · I=Interval · MP=Marathon Pace · TT=Time Trial
        </span>
      </div>
    </div>
  );
}

export function PlanTableEmpty() {
  return (
    <div className="text-center py-16 space-y-4">
      <p className="text-slate-500 text-lg">No active plan yet.</p>
      <p className="text-slate-400 text-sm">Build a personalised training plan to get started.</p>
      <Link
        href="/onboarding/wizard"
        className="inline-block px-5 py-2.5 rounded-lg bg-emerald-600 text-white font-medium hover:bg-emerald-700 transition-colors"
      >
        Start Wizard
      </Link>
    </div>
  );
}

// Re-export for use in server component
export { secondsToTimeString };
