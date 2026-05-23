'use client';

import { useState, useTransition } from 'react';

type Comment = {
  id: string;
  comment: string;
  created_at: string;
  author_id: string;
};

type Props = {
  runId: string;
  initialComments: Comment[];
  currentUserId: string;
  canComment: boolean;
};

function formatTime(iso: string) {
  return new Date(iso).toLocaleString('en-AU', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function CommentsSection({ runId, initialComments, currentUserId, canComment }: Props) {
  const [comments, setComments] = useState<Comment[]>(initialComments);
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) return;
    setError(null);

    startTransition(async () => {
      try {
        const res = await fetch(`/api/runs/${runId}/comments`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ comment: trimmed }),
        });
        const json = (await res.json()) as { data?: Comment; error?: { message: string } };
        if (!res.ok) {
          setError(json.error?.message ?? 'Failed to post comment.');
          return;
        }
        if (json.data) setComments((prev) => [...prev, json.data!]);
        setText('');
      } catch {
        setError('Network error. Please try again.');
      }
    });
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 space-y-4">
      <h2 className="font-semibold text-slate-700 text-sm uppercase tracking-wide">Comments</h2>

      {comments.length === 0 ? (
        <p className="text-slate-400 text-sm">No comments yet.</p>
      ) : (
        <ul className="space-y-3">
          {comments.map((c) => (
            <li key={c.id} className="flex gap-3">
              <div className="flex-shrink-0 w-7 h-7 rounded-full bg-slate-200 flex items-center justify-center text-xs font-medium text-slate-600">
                {c.author_id === currentUserId ? 'Me' : 'C'}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2">
                  <span className="text-xs font-medium text-slate-600">
                    {c.author_id === currentUserId ? 'You' : 'Coach'}
                  </span>
                  <span className="text-xs text-slate-400">{formatTime(c.created_at)}</span>
                </div>
                <p className="text-sm text-slate-800 mt-0.5">{c.comment}</p>
              </div>
            </li>
          ))}
        </ul>
      )}

      {canComment && (
        <form onSubmit={handleSubmit} className="space-y-2">
          {error && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-2 py-1">
              {error}
            </p>
          )}
          <div className="flex gap-2">
            <input
              type="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Add a comment…"
              maxLength={500}
              className="flex-1 min-w-0 rounded-md border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
            />
            <button
              type="submit"
              disabled={isPending || !text.trim()}
              className="px-4 py-2 rounded-md bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isPending ? '…' : 'Post'}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
