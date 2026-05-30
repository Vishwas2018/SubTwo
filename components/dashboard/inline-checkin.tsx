'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { CheckinInput } from '@/lib/schemas';

type Prefill = Partial<CheckinInput> | null;

function RatingButtons({
  value,
  onChange,
  name,
}: {
  value: number | null;
  onChange: (v: number) => void;
  name: string;
}) {
  return (
    <div className="flex gap-1.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          aria-label={`${name} ${n}`}
          onClick={() => onChange(n)}
          className={`w-9 h-9 rounded-full text-sm font-semibold border transition-colors ${
            value === n
              ? 'bg-emerald-600 text-white border-emerald-600'
              : 'bg-white text-slate-600 border-slate-300 hover:border-emerald-400'
          }`}
        >
          {n}
        </button>
      ))}
    </div>
  );
}

export function InlineCheckin({ today, prefill }: { today: string; prefill: Prefill }) {
  const [collapsed, setCollapsed] = useState(prefill !== null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [sleepHours, setSleepHours] = useState(prefill?.sleep_hours?.toString() ?? '');
  const [restingHr, setRestingHr] = useState(prefill?.resting_hr?.toString() ?? '');
  const [energy, setEnergy] = useState<number | null>(prefill?.energy_1to5 ?? null);
  const [mood, setMood] = useState<number | null>(prefill?.mood_1to5 ?? null);
  const [niggle, setNiggle] = useState(prefill?.niggle_today ?? false);
  const [notes, setNotes] = useState(prefill?.notes ?? '');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const body: Record<string, unknown> = { checkin_date: today };
    if (sleepHours) body.sleep_hours = parseFloat(sleepHours);
    if (restingHr) body.resting_hr = parseInt(restingHr);
    if (energy) body.energy_1to5 = energy;
    if (mood) body.mood_1to5 = mood;
    body.niggle_today = niggle;
    if (notes.trim()) body.notes = notes.trim();

    startTransition(async () => {
      try {
        const res = await fetch('/api/checkins', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        const json = (await res.json()) as { data?: unknown; error?: { message: string } };

        if (!res.ok) {
          setError(json.error?.message ?? 'Failed to save check-in.');
          return;
        }

        setCollapsed(true);
      } catch {
        setError('Network error. Please try again.');
      }
    });
  }

  if (collapsed) {
    return (
      <div
        data-testid="checkin-collapsed"
        className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 flex items-center justify-between"
      >
        <p className="text-sm font-medium text-emerald-700">✓ Checked in today</p>
        <button
          type="button"
          onClick={() => setCollapsed(false)}
          className="text-sm text-emerald-600 font-medium hover:underline"
        >
          Edit
        </button>
      </div>
    );
  }

  return (
    <form
      data-testid="checkin-form"
      onSubmit={handleSubmit}
      className="rounded-xl border border-slate-200 bg-white p-5 space-y-4"
    >
      <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">Daily Check-in</p>

      {error && (
        <div className="rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label htmlFor="ci-sleep" className="text-xs">Sleep (h)</Label>
          <Input
            id="ci-sleep"
            type="number"
            step="0.5"
            min="0"
            max="24"
            placeholder="e.g. 7.5"
            value={sleepHours}
            onChange={(e) => setSleepHours(e.target.value)}
            className="h-9"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="ci-rhr" className="text-xs">Resting HR (bpm)</Label>
          <Input
            id="ci-rhr"
            type="number"
            min="30"
            max="120"
            placeholder="Optional"
            value={restingHr}
            onChange={(e) => setRestingHr(e.target.value)}
            className="h-9"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Energy</Label>
        <RatingButtons value={energy} onChange={setEnergy} name="Energy" />
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Mood</Label>
        <RatingButtons value={mood} onChange={setMood} name="Mood" />
      </div>

      <div className="flex items-center gap-2">
        <input
          id="ci-niggle"
          type="checkbox"
          checked={niggle}
          onChange={(e) => setNiggle(e.target.checked)}
          className="h-4 w-4 rounded border-slate-300 text-amber-500"
        />
        <Label htmlFor="ci-niggle" className="text-sm cursor-pointer">
          Niggle / soreness today
        </Label>
      </div>

      {niggle && (
        <div className="space-y-1">
          <Label htmlFor="ci-notes" className="text-xs">Description (optional)</Label>
          <Textarea
            id="ci-notes"
            maxLength={500}
            placeholder="What hurts? Where?"
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>
      )}

      <Button
        type="submit"
        disabled={isPending}
        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
      >
        {isPending ? 'Saving…' : 'Save Check-in'}
      </Button>
    </form>
  );
}
