'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

type Niggle = {
  id: string;
  body_part: string;
  severity: number;
  started_date: string;
  resolved_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

const BODY_PART_LABELS: Record<string, string> = {
  knee: 'Knee',
  hip: 'Hip',
  hamstring: 'Hamstring',
  calf: 'Calf',
  it_band: 'IT Band',
  shin: 'Shin',
  foot: 'Foot',
  ankle: 'Ankle',
  glute: 'Glute',
  quad: 'Quad',
  lower_back: 'Lower Back',
  upper_back: 'Upper Back',
  shoulder: 'Shoulder',
  achilles: 'Achilles',
  plantar_fascia: 'Plantar Fascia',
  other: 'Other',
};

const BODY_PART_OPTIONS = Object.entries(BODY_PART_LABELS).map(([value, label]) => ({ value, label }));

function daysActive(startedDate: string, resolvedDate: string | null): number {
  const end = resolvedDate ? new Date(resolvedDate) : new Date();
  const start = new Date(startedDate);
  return Math.max(0, Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
}

function SeverityBar({ value }: { value: number }) {
  const color =
    value <= 3 ? 'bg-emerald-500' : value <= 6 ? 'bg-amber-500' : 'bg-red-500';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${(value / 10) * 100}%` }} />
      </div>
      <span className="text-sm font-semibold text-slate-700 w-4">{value}</span>
    </div>
  );
}

function NiggleCard({ niggle, onUpdated }: { niggle: Niggle; onUpdated: () => void }) {
  const [isPending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [newSeverity, setNewSeverity] = useState(niggle.severity);
  const [error, setError] = useState<string | null>(null);
  const days = daysActive(niggle.started_date, niggle.resolved_date);

  function patch(body: Record<string, unknown>) {
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/niggles/${niggle.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        const json = (await res.json()) as { error?: { message: string } };
        if (!res.ok) {
          setError(json.error?.message ?? 'Update failed.');
          return;
        }
        setEditing(false);
        onUpdated();
      } catch {
        setError('Network error. Please try again.');
      }
    });
  }

  function handleResolve() {
    patch({ resolved_date: new Date().toISOString().split('T')[0]! });
  }

  function handleSeverityUpdate() {
    patch({ severity: newSeverity });
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-slate-900">
            {BODY_PART_LABELS[niggle.body_part] ?? niggle.body_part}
          </p>
          <p className="text-sm text-slate-500">
            Since {niggle.started_date}
            {niggle.resolved_date
              ? ` → resolved ${niggle.resolved_date}`
              : ` · ${days} day${days !== 1 ? 's' : ''}`}
          </p>
        </div>
        {!niggle.resolved_date && (
          <span
            className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold border ${
              niggle.severity >= 7
                ? 'bg-red-100 text-red-700 border-red-300'
                : niggle.severity >= 4
                ? 'bg-amber-100 text-amber-700 border-amber-300'
                : 'bg-emerald-100 text-emerald-700 border-emerald-300'
            }`}
          >
            Severity {niggle.severity}/10
          </span>
        )}
      </div>

      <SeverityBar value={niggle.severity} />

      {niggle.notes && (
        <p className="text-sm text-slate-600 bg-slate-50 rounded px-3 py-2">{niggle.notes}</p>
      )}

      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}

      {!niggle.resolved_date && (
        <>
          {editing ? (
            <div className="space-y-2">
              <Label>Update severity: {newSeverity}/10</Label>
              <input
                type="range"
                min={1}
                max={10}
                value={newSeverity}
                onChange={(e) => setNewSeverity(parseInt(e.target.value, 10))}
                className="w-full accent-emerald-600"
              />
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => setEditing(false)} disabled={isPending}>
                  Cancel
                </Button>
                <Button
                  size="sm"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                  onClick={handleSeverityUpdate}
                  disabled={isPending}
                >
                  {isPending ? 'Saving…' : 'Save'}
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex gap-2 flex-wrap">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setEditing(true)}
                disabled={isPending}
              >
                Update Severity
              </Button>
              <Button
                size="sm"
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
                onClick={handleResolve}
                disabled={isPending}
              >
                {isPending ? 'Resolving…' : 'Mark Resolved'}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function AddNiggleForm({ onAdded }: { onAdded: () => void }) {
  const [isPending, startTransition] = useTransition();
  const [bodyPart, setBodyPart] = useState('');
  const [severity, setSeverity] = useState(5);
  const [startedDate, setStartedDate] = useState(new Date().toISOString().split('T')[0]!);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!bodyPart) {
      setError('Select a body part.');
      return;
    }
    startTransition(async () => {
      try {
        const res = await fetch('/api/niggles', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            body_part: bodyPart,
            severity,
            started_date: startedDate,
            notes: notes.trim() || undefined,
          }),
        });
        const json = (await res.json()) as { error?: { message: string } };
        if (!res.ok) {
          setError(json.error?.message ?? 'Failed to add niggle.');
          return;
        }
        setBodyPart('');
        setSeverity(5);
        setStartedDate(new Date().toISOString().split('T')[0]!);
        setNotes('');
        onAdded();
      } catch {
        setError('Network error. Please try again.');
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-lg border border-slate-200 bg-white p-5 space-y-4">
      <h3 className="font-semibold text-slate-900">Add a Niggle</h3>

      {error && (
        <div className="rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-700">{error}</div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1">
          <Label htmlFor="body-part">Body part</Label>
          <select
            id="body-part"
            value={bodyPart}
            onChange={(e) => setBodyPart(e.target.value)}
            className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            required
          >
            <option value="">Select…</option>
            {BODY_PART_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <Label htmlFor="started-date">Started date</Label>
          <Input
            id="started-date"
            type="date"
            value={startedDate}
            onChange={(e) => setStartedDate(e.target.value)}
            required
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Severity: {severity}/10</Label>
        <input
          type="range"
          min={1}
          max={10}
          value={severity}
          onChange={(e) => setSeverity(parseInt(e.target.value, 10))}
          className="w-full accent-emerald-600"
        />
        <div className="flex justify-between text-xs text-slate-400">
          <span>1 Mild</span>
          <span>10 Severe</span>
        </div>
      </div>

      <div className="space-y-1">
        <Label htmlFor="niggle-notes">Notes (optional)</Label>
        <Textarea
          id="niggle-notes"
          maxLength={500}
          placeholder="Describe the pain or discomfort…"
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>

      <Button
        type="submit"
        disabled={isPending}
        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
      >
        {isPending ? 'Adding…' : 'Add Niggle'}
      </Button>
    </form>
  );
}

export function NigglesClient({ initialNiggles }: { initialNiggles: Niggle[] }) {
  const router = useRouter();
  const [tab, setTab] = useState<'active' | 'resolved'>('active');

  const active = initialNiggles.filter((n) => !n.resolved_date);
  const resolved = initialNiggles.filter((n) => n.resolved_date);

  // 5-day physio banner: any active niggle has been active ≥ 5 days
  const showPhysioBanner = active.some((n) => daysActive(n.started_date, null) >= 5);

  function refresh() {
    router.refresh();
  }

  const displayed = tab === 'active' ? active : resolved;

  return (
    <div className="space-y-5">
      {showPhysioBanner && (
        <div className="rounded-lg bg-amber-50 border border-amber-300 px-4 py-3 text-sm text-amber-800">
          <span className="font-semibold">Consider seeing a physio.</span> You have a niggle that has been active for 5 or more days.
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg bg-slate-100 p-1 w-fit">
        {(['active', 'resolved'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors capitalize ${
              tab === t ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-800'
            }`}
          >
            {t} ({t === 'active' ? active.length : resolved.length})
          </button>
        ))}
      </div>

      {/* Cards */}
      {displayed.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 py-10 text-center">
          <p className="text-slate-500 text-sm">
            {tab === 'active' ? 'No active niggles — great work!' : 'No resolved niggles yet.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {displayed.map((n) => (
            <NiggleCard key={n.id} niggle={n} onUpdated={refresh} />
          ))}
        </div>
      )}

      {/* Add form */}
      <AddNiggleForm onAdded={refresh} />
    </div>
  );
}
