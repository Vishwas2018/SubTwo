'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
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
    <div className="flex gap-2">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          aria-label={`${name} ${n}`}
          onClick={() => onChange(n)}
          className={`w-10 h-10 rounded-full text-sm font-semibold border transition-colors ${
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

export function CheckinForm({
  today,
  prefill,
}: {
  today: string;
  prefill: Prefill;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [sleepHours, setSleepHours] = useState(prefill?.sleep_hours?.toString() ?? '');
  const [restingHr, setRestingHr] = useState(prefill?.resting_hr?.toString() ?? '');
  const [weightKg, setWeightKg] = useState(prefill?.weight_kg?.toString() ?? '');
  const [energy, setEnergy] = useState<number | null>(prefill?.energy_1to5 ?? null);
  const [mood, setMood] = useState<number | null>(prefill?.mood_1to5 ?? null);
  const [niggle, setNiggle] = useState(prefill?.niggle_today ?? false);
  const [notes, setNotes] = useState(prefill?.notes ?? '');
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);

    const body: Record<string, unknown> = { checkin_date: today };
    if (sleepHours) body.sleep_hours = parseFloat(sleepHours);
    if (restingHr) body.resting_hr = parseInt(restingHr);
    if (weightKg) body.weight_kg = parseFloat(weightKg);
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

        setSaved(true);
        router.refresh();
      } catch {
        setError('Network error. Please try again.');
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-700">
          {error}
        </div>
      )}
      {saved && (
        <div className="rounded-md bg-emerald-50 border border-emerald-200 p-3 text-sm text-emerald-700">
          Check-in saved for {today}.
        </div>
      )}

      {/* Sleep */}
      <div className="space-y-1">
        <Label htmlFor="sleep">Sleep (hours)</Label>
        <Input
          id="sleep"
          type="number"
          step="0.5"
          min="0"
          max="24"
          placeholder="e.g. 7.5"
          value={sleepHours}
          onChange={(e) => setSleepHours(e.target.value)}
        />
      </div>

      {/* RHR + Weight */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <Label htmlFor="rhr">Resting HR (bpm)</Label>
          <Input
            id="rhr"
            type="number"
            min="30"
            max="120"
            placeholder="Optional"
            value={restingHr}
            onChange={(e) => setRestingHr(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="weight">Weight (kg)</Label>
          <Input
            id="weight"
            type="number"
            step="0.1"
            min="30"
            max="200"
            placeholder="Optional"
            value={weightKg}
            onChange={(e) => setWeightKg(e.target.value)}
          />
        </div>
      </div>

      {/* Energy */}
      <div className="space-y-2">
        <Label>Energy level</Label>
        <RatingButtons value={energy} onChange={setEnergy} name="Energy" />
        <div className="flex justify-between text-xs text-slate-400 px-1">
          <span>1 Drained</span>
          <span>5 Energised</span>
        </div>
      </div>

      {/* Mood */}
      <div className="space-y-2">
        <Label>Mood</Label>
        <RatingButtons value={mood} onChange={setMood} name="Mood" />
        <div className="flex justify-between text-xs text-slate-400 px-1">
          <span>1 Low</span>
          <span>5 Great</span>
        </div>
      </div>

      {/* Niggle */}
      <div className="flex items-center gap-3">
        <input
          id="niggle"
          type="checkbox"
          checked={niggle}
          onChange={(e) => setNiggle(e.target.checked)}
          className="h-4 w-4 rounded border-slate-300 text-amber-500"
        />
        <Label htmlFor="niggle" className="cursor-pointer">
          Niggle / soreness today
        </Label>
      </div>

      {/* Notes */}
      <div className="space-y-1">
        <Label htmlFor="notes">Notes (optional)</Label>
        <Textarea
          id="notes"
          maxLength={500}
          placeholder="How are you feeling?"
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>

      <Button
        type="submit"
        disabled={isPending}
        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
      >
        {isPending ? 'Saving…' : prefill ? 'Update Check-in' : 'Save Check-in'}
      </Button>
    </form>
  );
}
