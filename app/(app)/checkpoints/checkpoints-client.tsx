'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { secondsToTimeString } from '@/lib/pace-zones';

type CheckpointSpec = {
  week: number;
  type: string;
  target_seconds: number;
  target_distance_km: number;
};

type CompletedCheckpoint = {
  id: string;
  checkpoint_type: string;
  actual_date: string;
  result_seconds: number;
  target_seconds: number;
  verdict: string;
  pct_deviation: number | null;
  recommended_action: string | null;
  athlete_notes: string | null;
};

type EnrichedSpec = {
  spec: CheckpointSpec;
  completed: CompletedCheckpoint | null;
};

const VERDICT_COLORS: Record<string, string> = {
  green: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  amber: 'bg-amber-100 text-amber-800 border-amber-300',
  red: 'bg-red-100 text-red-800 border-red-300',
};

const VERDICT_LABELS: Record<string, string> = {
  green: 'On Track',
  amber: 'Slightly Behind',
  red: 'Significantly Behind',
};

function VerdictBadge({ verdict }: { verdict: string }) {
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${VERDICT_COLORS[verdict] ?? 'bg-slate-100 text-slate-600 border-slate-300'}`}
    >
      {VERDICT_LABELS[verdict] ?? verdict}
    </span>
  );
}

function LogResultModal({
  spec,
  onClose,
  onSaved,
}: {
  spec: CheckpointSpec;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]!);
  const [minutes, setMinutes] = useState('');
  const [seconds, setSeconds] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const mins = parseInt(minutes || '0', 10);
    const secs = parseInt(seconds || '0', 10);
    if (isNaN(mins) || isNaN(secs) || mins < 0 || secs < 0 || secs >= 60) {
      setError('Enter a valid time (minutes and 0–59 seconds).');
      return;
    }
    const result_seconds = mins * 60 + secs;
    if (result_seconds < 1) {
      setError('Result time must be greater than zero.');
      return;
    }

    startTransition(async () => {
      try {
        const res = await fetch('/api/checkpoints', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            checkpoint_type: spec.type,
            actual_date: date,
            result_seconds,
            athlete_notes: notes.trim() || undefined,
          }),
        });
        const json = (await res.json()) as { data?: unknown; error?: { message: string } };
        if (!res.ok) {
          setError(json.error?.message ?? 'Failed to save checkpoint.');
          return;
        }
        onSaved();
      } catch {
        setError('Network error. Please try again.');
      }
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6 space-y-5">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Log Checkpoint Result</h2>
          <p className="text-sm text-slate-500 mt-0.5">{spec.type} · Week {spec.week} · Target: {secondsToTimeString(spec.target_seconds, { forceHours: spec.target_seconds >= 3600 })}</p>
        </div>

        {error && (
          <div className="rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-700">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="cp-date">Date</Label>
            <Input
              id="cp-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </div>

          <div className="space-y-1">
            <Label>Result time</Label>
            <div className="flex items-center gap-2">
              <div className="flex-1 space-y-0.5">
                <Input
                  type="number"
                  min="0"
                  max="999"
                  placeholder="Min"
                  value={minutes}
                  onChange={(e) => setMinutes(e.target.value)}
                  aria-label="Minutes"
                />
                <p className="text-xs text-slate-400 text-center">min</p>
              </div>
              <span className="text-slate-400 font-bold text-lg mb-4">:</span>
              <div className="flex-1 space-y-0.5">
                <Input
                  type="number"
                  min="0"
                  max="59"
                  placeholder="Sec"
                  value={seconds}
                  onChange={(e) => setSeconds(e.target.value)}
                  aria-label="Seconds"
                />
                <p className="text-xs text-slate-400 text-center">sec</p>
              </div>
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="cp-notes">Notes (optional)</Label>
            <Textarea
              id="cp-notes"
              maxLength={500}
              placeholder="How did it go?"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          <div className="flex gap-3 pt-1">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={onClose}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isPending}
              className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {isPending ? 'Saving…' : 'Save Result'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function CheckpointCard({ item }: { item: EnrichedSpec }) {
  const router = useRouter();
  const [showModal, setShowModal] = useState(false);
  const { spec, completed } = item;

  function handleSaved() {
    setShowModal(false);
    router.refresh();
  }

  if (completed) {
    const devStr =
      completed.pct_deviation !== null
        ? `${completed.pct_deviation >= 0 ? '+' : ''}${completed.pct_deviation.toFixed(1)}%`
        : null;

    return (
      <div className="rounded-lg border border-slate-200 bg-white p-5 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-semibold text-slate-900">{spec.type}</p>
            <p className="text-sm text-slate-500">Week {spec.week} · {spec.target_distance_km} km</p>
          </div>
          <VerdictBadge verdict={completed.verdict} />
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wide">Target</p>
            <p className="font-mono font-medium text-slate-700">
              {secondsToTimeString(spec.target_seconds, { forceHours: spec.target_seconds >= 3600 })}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wide">Result</p>
            <p className="font-mono font-medium text-slate-700">
              {secondsToTimeString(completed.result_seconds, { forceHours: completed.result_seconds >= 3600 })}
            </p>
          </div>
          {devStr && (
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wide">Deviation</p>
              <p className={`font-mono font-medium ${completed.pct_deviation! >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                {devStr}
              </p>
            </div>
          )}
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wide">Logged</p>
            <p className="text-slate-600">{completed.actual_date}</p>
          </div>
        </div>

        {completed.recommended_action && (
          <div className="rounded-md bg-slate-50 border border-slate-200 px-3 py-2 text-sm text-slate-700">
            {completed.recommended_action}
          </div>
        )}
      </div>
    );
  }

  // Pending
  return (
    <>
      <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-5 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-semibold text-slate-700">{spec.type}</p>
            <p className="text-sm text-slate-500">
              Week {spec.week} · {spec.target_distance_km} km · Target:{' '}
              <span className="font-mono">
                {secondsToTimeString(spec.target_seconds, { forceHours: spec.target_seconds >= 3600 })}
              </span>
            </p>
          </div>
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-200 text-slate-600 border border-slate-300">
            Pending
          </span>
        </div>
        <Button
          size="sm"
          className="bg-emerald-600 hover:bg-emerald-700 text-white"
          onClick={() => setShowModal(true)}
        >
          Log Result
        </Button>
      </div>

      {showModal && (
        <LogResultModal spec={spec} onClose={() => setShowModal(false)} onSaved={handleSaved} />
      )}
    </>
  );
}

export function CheckpointsList({ items }: { items: EnrichedSpec[] }) {
  if (items.length === 0) {
    return (
      <div className="text-center py-12 space-y-2">
        <p className="text-slate-500">No checkpoints defined in your plan yet.</p>
        <p className="text-slate-400 text-sm">Checkpoints are generated when your plan is created.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {items.map((item) => (
        <CheckpointCard key={item.spec.type} item={item} />
      ))}
    </div>
  );
}
