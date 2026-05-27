'use client';

import { useEffect, useState } from 'react';

type AiUsageData = {
  month_spend: number;
  soft_cap: number;
  hard_cap: number;
  soft_exceeded: boolean;
  hard_exceeded: boolean;
  per_user: { user_id: string; email: string; generation_count: number; total_cost: number }[];
  recent: {
    user_id: string | null;
    purpose: string;
    model: string;
    cost: number;
    success: boolean | null;
    created_at: string;
  }[];
};

function SpendBar({ spend, cap, label }: { spend: number; cap: number; label: string }) {
  const pct = Math.min((spend / cap) * 100, 100);
  const exceeded = spend >= cap;
  return (
    <div className="flex items-center gap-3">
      <span className="w-24 text-right text-xs text-gray-500">{label}</span>
      <div className="flex-1 overflow-hidden rounded-full bg-gray-100 h-3">
        <div
          className={`h-3 rounded-full transition-all ${exceeded ? 'bg-red-500' : 'bg-blue-500'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="w-32 text-xs text-gray-600">
        ${spend.toFixed(4)} / ${cap}
        {exceeded && (
          <span className="ml-1 font-semibold text-red-600">EXCEEDED</span>
        )}
      </span>
    </div>
  );
}

export default function AiUsagePage() {
  const [data, setData] = useState<AiUsageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/admin/ai-usage')
      .then((r) => r.json())
      .then((j) => {
        if (j.data) setData(j.data);
        else setError(j.error ?? 'Failed to load');
      })
      .catch(() => setError('Network error'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-sm text-gray-500">Loading…</p>;
  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (!data) return null;

  return (
    <div className="space-y-8">
      <h1 className="text-xl font-bold text-gray-900">AI Usage</h1>

      {/* Spend vs caps */}
      <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-sm font-semibold text-gray-700">This Month — Global Spend</h2>
        <div className="space-y-3">
          <SpendBar spend={data.month_spend} cap={data.soft_cap} label="Soft cap" />
          <SpendBar spend={data.month_spend} cap={data.hard_cap} label="Hard cap" />
        </div>
        <p className="mt-3 text-xs text-gray-400">
          Total: ${data.month_spend.toFixed(4)} · Soft ${data.soft_cap} · Hard ${data.hard_cap}
        </p>
      </div>

      {/* Per-user table */}
      <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 px-5 py-3">
          <h2 className="text-sm font-semibold text-gray-700">Top Users (this month)</h2>
        </div>
        {data.per_user.length === 0 ? (
          <p className="px-5 py-4 text-sm text-gray-500">No generations this month.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-90 text-sm">
              <thead className="border-b border-gray-100 bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-4 py-3">User</th>
                  <th className="px-4 py-3">Generations</th>
                  <th className="px-4 py-3">Est. Cost</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.per_user.map((u) => (
                  <tr key={u.user_id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-800 break-all">{u.email}</td>
                    <td className="px-4 py-3 text-gray-600">{u.generation_count}</td>
                    <td className="px-4 py-3 text-gray-600">${u.total_cost.toFixed(4)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Recent generations */}
      <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-200 px-5 py-3">
          <h2 className="text-sm font-semibold text-gray-700">Recent Generations (last 20)</h2>
        </div>
        {data.recent.length === 0 ? (
          <p className="px-5 py-4 text-sm text-gray-500">None.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-120 text-sm">
              <thead className="border-b border-gray-100 bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-4 py-3">Purpose</th>
                  <th className="px-4 py-3">Model</th>
                  <th className="px-4 py-3">Cost</th>
                  <th className="px-4 py-3">Success</th>
                  <th className="px-4 py-3">When</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.recent.map((g, i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-700">{g.purpose}</td>
                    <td className="px-4 py-3 text-gray-500">{g.model}</td>
                    <td className="px-4 py-3 text-gray-600">${g.cost.toFixed(4)}</td>
                    <td className="px-4 py-3">
                      {g.success ? (
                        <span className="text-green-600">✓</span>
                      ) : (
                        <span className="text-red-500">✗</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs">
                      {new Date(g.created_at).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
