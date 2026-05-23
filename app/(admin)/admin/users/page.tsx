'use client';

import { useEffect, useState } from 'react';

type User = {
  id: string;
  email: string;
  display_name: string | null;
  is_admin: boolean;
  suspended: boolean;
  created_at: string;
  plan_count: number;
  run_count: number;
};

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [confirming, setConfirming] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  // Only updates state after async operations — safe to call from useEffect
  async function load() {
    try {
      const res = await fetch('/api/admin/users');
      const json = await res.json();
      setUsers(json.data ?? []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function toggleSuspend(user: User) {
    if (!confirming) {
      setConfirming(user.id);
      return;
    }
    if (confirming !== user.id) {
      setConfirming(user.id);
      return;
    }
    setBusy(user.id);
    setConfirming(null);
    const res = await fetch(`/api/admin/users/${user.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ suspended: !user.suspended }),
    });
    setBusy(null);
    if (!res.ok) {
      const j = await res.json();
      setError(j.error ?? 'Failed');
    }
    setLoading(true);
    load();
  }

  return (
    <div>
      <h1 className="mb-6 text-xl font-bold text-gray-900">Users</h1>

      {error && (
        <div className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</div>
      )}

      {loading ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-200 bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Plans</th>
                <th className="px-4 py-3">Runs</th>
                <th className="px-4 py-3">Joined</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {users.map((u) => (
                <tr key={u.id} className={`hover:bg-gray-50 ${u.suspended ? 'opacity-60' : ''}`}>
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">{u.email}</div>
                    {u.is_admin && (
                      <span className="text-xs text-red-600 font-medium">admin</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{u.plan_count}</td>
                  <td className="px-4 py-3 text-gray-600">{u.run_count}</td>
                  <td className="px-4 py-3 text-gray-500">
                    {new Date(u.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    {u.suspended ? (
                      <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                        Suspended
                      </span>
                    ) : (
                      <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                        Active
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {!u.is_admin && (
                      <button
                        onClick={() => toggleSuspend(u)}
                        disabled={busy === u.id}
                        className={`text-xs hover:underline disabled:opacity-50 ${
                          confirming === u.id
                            ? 'font-bold text-red-700'
                            : u.suspended
                              ? 'text-green-600'
                              : 'text-red-500'
                        }`}
                      >
                        {confirming === u.id
                          ? 'Confirm?'
                          : u.suspended
                            ? 'Unsuspend'
                            : 'Suspend'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {confirming && (
        <p className="mt-2 text-xs text-gray-500">
          Click again to confirm, or click elsewhere to cancel.
          <button
            onClick={() => setConfirming(null)}
            className="ml-2 text-gray-400 underline"
          >
            Cancel
          </button>
        </p>
      )}
    </div>
  );
}
