'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

type SessionOption = { id: string; label: string; scheduled_date: string };

type Props = {
  defaultDate: string;
  defaultSessionId: string | null;
  sessions: SessionOption[];
};

function toSeconds(h: string, m: string, s: string): number {
  return (parseInt(h || '0') * 3600) + (parseInt(m || '0') * 60) + (parseInt(s || '0'));
}

export function LogForm({ defaultDate, defaultSessionId, sessions }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [date, setDate] = useState(defaultDate);
  const [distKm, setDistKm] = useState('');
  const [hours, setHours] = useState('0');
  const [minutes, setMinutes] = useState('');
  const [seconds, setSeconds] = useState('0');
  const [avgHr, setAvgHr] = useState('');
  const [elevGain, setElevGain] = useState('');
  const [rpe, setRpe] = useState('');
  const [feltEasy, setFeltEasy] = useState(false);
  const [stitchOccurred, setStitchOccurred] = useState(false);
  const [stitchSeverity, setStitchSeverity] = useState('');
  const [shoes, setShoes] = useState('');
  const [notes, setNotes] = useState('');
  const [sessionId, setSessionId] = useState(defaultSessionId ?? '');
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const durationSec = toSeconds(hours, minutes, seconds);
    if (!distKm || parseFloat(distKm) <= 0) {
      setError('Distance is required.');
      return;
    }
    if (durationSec <= 0) {
      setError('Duration is required.');
      return;
    }
    if (stitchOccurred && !stitchSeverity) {
      setError('Stitch severity is required when stitch occurred.');
      return;
    }

    const body: Record<string, unknown> = {
      run_date: date,
      distance_km: parseFloat(distKm),
      duration_seconds: durationSec,
    };
    if (avgHr) body.avg_hr = parseInt(avgHr);
    if (elevGain) body.elevation_gain_m = parseInt(elevGain);
    if (rpe) body.rpe = parseInt(rpe);
    body.felt_easy = feltEasy;
    body.stitch_occurred = stitchOccurred;
    if (stitchOccurred && stitchSeverity) body.stitch_severity = parseInt(stitchSeverity);
    if (shoes.trim()) body.shoes = shoes.trim();
    if (notes.trim()) body.notes = notes.trim();
    if (sessionId) body.planned_session_id = sessionId;

    startTransition(async () => {
      try {
        const res = await fetch('/api/runs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        const json = (await res.json()) as { data?: { run_id: string }; error?: { message: string } };

        if (!res.ok) {
          setError(json.error?.message ?? 'Failed to save run.');
          return;
        }

        router.push('/dashboard');
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

      {/* Date */}
      <div className="space-y-1">
        <Label htmlFor="run-date">Date</Label>
        <Input
          id="run-date"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          required
        />
      </div>

      {/* Distance */}
      <div className="space-y-1">
        <Label htmlFor="distance">Distance (km)</Label>
        <Input
          id="distance"
          type="number"
          step="0.01"
          min="0.1"
          max="100"
          placeholder="e.g. 10.5"
          value={distKm}
          onChange={(e) => setDistKm(e.target.value)}
          required
        />
      </div>

      {/* Duration */}
      <div className="space-y-1">
        <Label>Duration</Label>
        <div className="flex items-center gap-2">
          <div className="flex flex-col items-center">
            <Input
              type="number"
              min="0"
              max="23"
              placeholder="0"
              value={hours}
              onChange={(e) => setHours(e.target.value)}
              className="w-16 text-center"
            />
            <span className="text-xs text-slate-400 mt-1">h</span>
          </div>
          <span className="text-slate-500 text-lg pb-4">:</span>
          <div className="flex flex-col items-center">
            <Input
              type="number"
              min="0"
              max="59"
              placeholder="00"
              value={minutes}
              onChange={(e) => setMinutes(e.target.value)}
              className="w-16 text-center"
              required
            />
            <span className="text-xs text-slate-400 mt-1">m</span>
          </div>
          <span className="text-slate-500 text-lg pb-4">:</span>
          <div className="flex flex-col items-center">
            <Input
              type="number"
              min="0"
              max="59"
              placeholder="00"
              value={seconds}
              onChange={(e) => setSeconds(e.target.value)}
              className="w-16 text-center"
            />
            <span className="text-xs text-slate-400 mt-1">s</span>
          </div>
        </div>
      </div>

      {/* HR + Elevation */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1">
          <Label htmlFor="avg-hr">Avg HR (bpm)</Label>
          <Input
            id="avg-hr"
            type="number"
            min="40"
            max="220"
            placeholder="Optional"
            value={avgHr}
            onChange={(e) => setAvgHr(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="elev">Elevation gain (m)</Label>
          <Input
            id="elev"
            type="number"
            min="0"
            max="5000"
            placeholder="Optional"
            value={elevGain}
            onChange={(e) => setElevGain(e.target.value)}
          />
        </div>
      </div>

      {/* RPE */}
      <div className="space-y-2">
        <Label htmlFor="rpe">
          RPE {rpe ? `— ${rpe}/10` : '(optional)'}
        </Label>
        <input
          id="rpe"
          type="range"
          min="1"
          max="10"
          step="1"
          value={rpe || ''}
          onChange={(e) => setRpe(e.target.value)}
          className="w-full accent-emerald-600"
        />
        <div className="flex justify-between text-xs text-slate-400">
          <span>1 Easy</span>
          <span>10 Max</span>
        </div>
      </div>

      {/* Felt easy */}
      <div className="flex items-center gap-3">
        <input
          id="felt-easy"
          type="checkbox"
          checked={feltEasy}
          onChange={(e) => setFeltEasy(e.target.checked)}
          className="h-4 w-4 rounded border-slate-300 text-emerald-600"
        />
        <Label htmlFor="felt-easy" className="cursor-pointer">Felt easy</Label>
      </div>

      {/* Stitch */}
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <input
            id="stitch"
            type="checkbox"
            checked={stitchOccurred}
            onChange={(e) => {
              setStitchOccurred(e.target.checked);
              if (!e.target.checked) setStitchSeverity('');
            }}
            className="h-4 w-4 rounded border-slate-300 text-emerald-600"
          />
          <Label htmlFor="stitch" className="cursor-pointer">Stitch occurred</Label>
        </div>
        {stitchOccurred && (
          <div className="ml-7 space-y-2">
            <Label htmlFor="stitch-severity">
              Stitch severity — {stitchSeverity ? `${stitchSeverity}/10` : 'required'}
            </Label>
            <input
              id="stitch-severity"
              type="range"
              min="1"
              max="10"
              step="1"
              value={stitchSeverity || ''}
              onChange={(e) => setStitchSeverity(e.target.value)}
              className="w-full accent-red-500"
              required={stitchOccurred}
            />
            <div className="flex justify-between text-xs text-slate-400">
              <span>1 Mild</span>
              <span>10 Severe</span>
            </div>
          </div>
        )}
      </div>

      {/* Shoes */}
      <div className="space-y-1">
        <Label htmlFor="shoes">Shoes (optional)</Label>
        <Input
          id="shoes"
          type="text"
          maxLength={100}
          placeholder="e.g. Nike Pegasus 41"
          value={shoes}
          onChange={(e) => setShoes(e.target.value)}
        />
      </div>

      {/* Link to session */}
      {sessions.length > 0 && (
        <div className="space-y-1">
          <Label htmlFor="session-link">Link to planned session (optional)</Label>
          <select
            id="session-link"
            value={sessionId}
            onChange={(e) => setSessionId(e.target.value)}
            className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="">— None —</option>
            {sessions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.scheduled_date} · {s.label}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Notes */}
      <div className="space-y-1">
        <Label htmlFor="notes">Notes (optional)</Label>
        <Textarea
          id="notes"
          maxLength={1000}
          placeholder="How did it go?"
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
        {isPending ? 'Saving…' : 'Log Run'}
      </Button>
    </form>
  );
}
