'use client';

import { useState } from 'react';

type Adjustment = {
  id: string;
  trigger: string;
  change_summary: string;
  change_details: unknown;
  affected_session_ids: string[] | null;
  user_override: boolean;
  created_at: string;
};

const TRIGGER_LABELS: Record<string, string> = {
  missed_sessions: 'Missed Sessions',
  rhr_elevated: 'Elevated RHR',
  niggle_persistent: 'Persistent Niggle',
  easy_too_fast: 'Easy Too Fast',
  sleep_deficit: 'Sleep Deficit',
  checkpoint_red: 'Checkpoint Red',
};

const TRIGGER_COLORS: Record<string, string> = {
  missed_sessions: 'bg-orange-100 text-orange-800',
  rhr_elevated: 'bg-red-100 text-red-800',
  niggle_persistent: 'bg-yellow-100 text-yellow-800',
  easy_too_fast: 'bg-blue-100 text-blue-800',
  sleep_deficit: 'bg-purple-100 text-purple-800',
  checkpoint_red: 'bg-red-100 text-red-800',
};

export default function AdjustmentsClient({
  planId,
  adjustments: initial,
}: {
  planId: string;
  adjustments: Adjustment[];
}) {
  const [adjustments, setAdjustments] = useState(initial);
  const [reverting, setReverting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleRevert(adjId: string) {
    setReverting(adjId);
    setError(null);
    try {
      const res = await fetch(`/api/plans/${planId}/adjustments/${adjId}/override`, {
        method: 'POST',
      });
      if (!res.ok) {
        const body = (await res.json()) as { error?: { message?: string } };
        setError(body.error?.message ?? 'Failed to revert adjustment.');
        return;
      }
      setAdjustments((prev) =>
        prev.map((a) => (a.id === adjId ? { ...a, user_override: true } : a)),
      );
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setReverting(null);
    }
  }

  if (adjustments.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-gray-300 py-12 text-center text-gray-500">
        <p className="font-medium">No adjustments yet</p>
        <p className="mt-1 text-sm">Adjustments are applied nightly based on your training data.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}
      {adjustments.map((adj) => (
        <div
          key={adj.id}
          className={`rounded-lg border p-4 ${adj.user_override ? 'border-gray-200 bg-gray-50 opacity-60' : 'border-gray-200 bg-white'}`}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span
                  className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${TRIGGER_COLORS[adj.trigger] ?? 'bg-gray-100 text-gray-700'}`}
                >
                  {TRIGGER_LABELS[adj.trigger] ?? adj.trigger}
                </span>
                {adj.user_override && (
                  <span className="inline-block rounded-full bg-gray-100 px-2.5 py-0.5 text-xs text-gray-500">
                    Reverted
                  </span>
                )}
                <span className="text-xs text-gray-400">
                  {new Date(adj.created_at).toLocaleDateString('en-AU', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}
                </span>
              </div>
              <p className="text-sm text-gray-800">{adj.change_summary}</p>
              {adj.affected_session_ids && adj.affected_session_ids.length > 0 && (
                <p className="mt-1 text-xs text-gray-500">
                  {adj.affected_session_ids.length} session
                  {adj.affected_session_ids.length > 1 ? 's' : ''} modified
                </p>
              )}
            </div>

            {!adj.user_override && (
              <button
                onClick={() => handleRevert(adj.id)}
                disabled={reverting === adj.id}
                className="shrink-0 rounded border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                {reverting === adj.id ? 'Reverting…' : 'Revert'}
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
