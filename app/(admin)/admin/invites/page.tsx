'use client';

import { useEffect, useState, useTransition } from 'react';

type InviteCode = {
  id: string;
  code: string;
  note: string | null;
  max_uses: number | null;
  use_count: number;
  expires_at: string | null;
  created_at: string;
  status: 'active' | 'used' | 'expired';
};

function StatusBadge({ status }: { status: InviteCode['status'] }) {
  const cls =
    status === 'active'
      ? 'bg-green-100 text-green-800'
      : status === 'used'
        ? 'bg-gray-100 text-gray-600'
        : 'bg-yellow-100 text-yellow-800';
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>
      {status}
    </span>
  );
}

export default function InvitesPage() {
  const [codes, setCodes] = useState<InviteCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [note, setNote] = useState('');
  const [expiresInDays, setExpiresInDays] = useState('');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function load() {
    setLoading(true);
    const res = await fetch('/api/admin/invites');
    const json = await res.json();
    setCodes(json.data ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const body: Record<string, unknown> = {};
    if (note.trim()) body.note = note.trim();
    if (expiresInDays) body.expires_in_days = parseInt(expiresInDays, 10);

    const res = await fetch('/api/admin/invites', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const j = await res.json();
      setError(j.error ?? 'Failed to create code');
      return;
    }
    setNote('');
    setExpiresInDays('');
    load();
  }

  async function handleRevoke(id: string) {
    startTransition(async () => {
      const res = await fetch(`/api/admin/invites/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const j = await res.json();
        setError(j.error ?? 'Failed to revoke');
        return;
      }
      load();
    });
  }

  function copyCode(code: string) {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(code);
      setTimeout(() => setCopied(null), 2000);
    });
  }

  return (
    <div>
      <h1 className="mb-6 text-xl font-bold text-gray-900">Invite Codes</h1>

      {/* Generate form */}
      <form
        onSubmit={handleCreate}
        className="mb-8 rounded-lg border border-gray-200 bg-white p-5 shadow-sm"
      >
        <h2 className="mb-4 text-sm font-semibold text-gray-700">Generate New Code</h2>
        <div className="flex flex-wrap gap-3">
          <input
            type="text"
            placeholder="Note (optional)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={200}
            className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
          />
          <input
            type="number"
            placeholder="Expires in days (optional)"
            value={expiresInDays}
            onChange={(e) => setExpiresInDays(e.target.value)}
            min={1}
            max={365}
            className="w-52 rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
          />
          <button
            type="submit"
            className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
          >
            Generate
          </button>
        </div>
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      </form>

      {/* Code table */}
      {loading ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : codes.length === 0 ? (
        <p className="text-sm text-gray-500">No invite codes yet.</p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-200 bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-3">Code</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Uses</th>
                <th className="px-4 py-3">Note</th>
                <th className="px-4 py-3">Expires</th>
                <th className="px-4 py-3">Created</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {codes.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-semibold tracking-widest text-gray-800">
                        {c.code}
                      </span>
                      <button
                        onClick={() => copyCode(c.code)}
                        className="rounded px-2 py-0.5 text-xs text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                        title="Copy code"
                      >
                        {copied === c.code ? 'Copied!' : 'Copy'}
                      </button>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={c.status} />
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {c.use_count}/{c.max_uses ?? '∞'}
                  </td>
                  <td className="px-4 py-3 text-gray-500">{c.note ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-500">
                    {c.expires_at ? new Date(c.expires_at).toLocaleDateString() : '—'}
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {new Date(c.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    {c.status === 'active' && c.use_count === 0 && (
                      <button
                        onClick={() => handleRevoke(c.id)}
                        disabled={isPending}
                        className="text-xs text-red-500 hover:underline disabled:opacity-50"
                      >
                        Revoke
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
