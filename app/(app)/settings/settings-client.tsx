'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type Profile = {
  id: string;
  email: string;
  display_name: string | null;
  timezone: string;
  ai_generation_count: number;
};

type ActivePlanInfo = {
  race_name: string | null;
  race_date: string;
  race_distance_km: number;
  total_weeks: number;
} | null;

type Tab = 'profile' | 'integrations' | 'sharing' | 'data';

function ProfileTab({ profile }: { profile: Profile }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [displayName, setDisplayName] = useState(profile.display_name ?? '');
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);

    startTransition(async () => {
      try {
        const res = await fetch('/api/me', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ display_name: displayName.trim() || null }),
        });
        const json = (await res.json()) as { error?: { message: string } };
        if (!res.ok) {
          setError(json.error?.message ?? 'Failed to save.');
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
    <form onSubmit={handleSave} className="space-y-5 max-w-md">
      {error && (
        <div className="rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-700">{error}</div>
      )}
      {saved && (
        <div className="rounded-md bg-emerald-50 border border-emerald-200 p-3 text-sm text-emerald-700">
          Profile saved.
        </div>
      )}

      <div className="space-y-1">
        <Label htmlFor="email">Email</Label>
        <Input id="email" type="text" value={profile.email} disabled className="bg-slate-50 text-slate-500" />
        <p className="text-xs text-slate-400">Email cannot be changed here.</p>
      </div>

      <div className="space-y-1">
        <Label htmlFor="display-name">Display name</Label>
        <Input
          id="display-name"
          type="text"
          maxLength={100}
          placeholder="e.g. Alex"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
        />
      </div>

      <div className="space-y-1">
        <Label>Timezone</Label>
        <Input type="text" value={profile.timezone} disabled className="bg-slate-50 text-slate-500" />
        <p className="text-xs text-slate-400">Timezone is set to Australia/Melbourne.</p>
      </div>

      <div className="space-y-1">
        <Label>AI generation count</Label>
        <p className="text-sm text-slate-600">{profile.ai_generation_count} / 3 used</p>
      </div>

      <Button
        type="submit"
        disabled={isPending}
        className="bg-emerald-600 hover:bg-emerald-700 text-white"
      >
        {isPending ? 'Saving…' : 'Save Profile'}
      </Button>
    </form>
  );
}

function RaceInfoSection({ plan }: { plan: ActivePlanInfo }) {
  if (!plan) {
    return (
      <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
        No active training plan.
      </div>
    );
  }
  const distLabel =
    plan.race_distance_km <= 5.1
      ? '5K'
      : plan.race_distance_km <= 10.1
      ? '10K'
      : plan.race_distance_km <= 21.5
      ? 'Half Marathon'
      : 'Marathon';

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 space-y-2 text-sm">
      <div className="flex justify-between">
        <span className="text-slate-500">Race</span>
        <span className="font-medium text-slate-900">{plan.race_name ?? distLabel}</span>
      </div>
      <div className="flex justify-between">
        <span className="text-slate-500">Date</span>
        <span className="font-medium text-slate-900">{plan.race_date}</span>
      </div>
      <div className="flex justify-between">
        <span className="text-slate-500">Distance</span>
        <span className="font-medium text-slate-900">{distLabel} ({plan.race_distance_km} km)</span>
      </div>
      <div className="flex justify-between">
        <span className="text-slate-500">Weeks</span>
        <span className="font-medium text-slate-900">{plan.total_weeks}</span>
      </div>
    </div>
  );
}

function IntegrationsTab() {
  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-6 text-center">
        <p className="text-sm font-medium text-slate-600">Strava Integration</p>
        <p className="text-xs text-slate-400 mt-1">Coming in Phase 5</p>
      </div>
      <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-6 text-center">
        <p className="text-sm font-medium text-slate-600">Garmin Integration</p>
        <p className="text-xs text-slate-400 mt-1">Coming in Phase 6</p>
      </div>
    </div>
  );
}

function SharingTab() {
  return (
    <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-6 text-center">
      <p className="text-sm font-medium text-slate-600">Coach Sharing</p>
      <p className="text-xs text-slate-400 mt-1">Share read-only access with your coach — coming in Phase 3.</p>
    </div>
  );
}

function DataTab({ email }: { email: string }) {
  const [deleting, setDeleting] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleExport() {
    window.location.href = '/api/export';
  }

  function handleDelete(e: React.FormEvent) {
    e.preventDefault();
    if (confirmText !== email) {
      setError('Email does not match. Type your email address to confirm.');
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch('/api/me', { method: 'DELETE' });
        const json = (await res.json()) as { error?: { message: string } };
        if (!res.ok) {
          setError(json.error?.message ?? 'Deletion failed.');
          return;
        }
        window.location.href = '/login';
      } catch {
        setError('Network error. Please try again.');
      }
    });
  }

  return (
    <div className="space-y-6 max-w-md">
      {/* Export */}
      <div className="rounded-lg border border-slate-200 bg-white p-5 space-y-3">
        <div>
          <p className="font-medium text-slate-900">Export your data</p>
          <p className="text-sm text-slate-500 mt-1">
            Download a complete JSON export of all your training data including runs, check-ins, checkpoints, and niggles.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={handleExport}
        >
          Download JSON Export
        </Button>
      </div>

      {/* Delete */}
      <div className="rounded-lg border border-red-200 bg-red-50 p-5 space-y-3">
        <div>
          <p className="font-medium text-red-900">Delete account</p>
          <p className="text-sm text-red-700 mt-1">
            Permanently delete your account and all associated data. This cannot be undone.
          </p>
        </div>

        {!deleting ? (
          <Button
            type="button"
            variant="outline"
            className="border-red-300 text-red-700 hover:bg-red-100"
            onClick={() => setDeleting(true)}
          >
            Delete Account
          </Button>
        ) : (
          <form onSubmit={handleDelete} className="space-y-3">
            {error && (
              <div className="rounded-md bg-white border border-red-300 p-3 text-sm text-red-700">{error}</div>
            )}
            <div className="space-y-1">
              <Label htmlFor="confirm-email" className="text-red-800">
                Type <span className="font-mono font-semibold">{email}</span> to confirm
              </Label>
              <Input
                id="confirm-email"
                type="text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder={email}
                className="border-red-300 focus:ring-red-500"
              />
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => { setDeleting(false); setConfirmText(''); setError(null); }}
                disabled={isPending}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isPending || confirmText !== email}
                className="bg-red-600 hover:bg-red-700 text-white disabled:opacity-50"
              >
                {isPending ? 'Deleting…' : 'Permanently Delete'}
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

export function SettingsClient({
  profile,
  activePlan,
}: {
  profile: Profile;
  activePlan: ActivePlanInfo;
}) {
  const [tab, setTab] = useState<Tab>('profile');

  const tabs: { id: Tab; label: string }[] = [
    { id: 'profile', label: 'Profile' },
    { id: 'integrations', label: 'Integrations' },
    { id: 'sharing', label: 'Sharing' },
    { id: 'data', label: 'Data' },
  ];

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="flex gap-1 rounded-lg bg-slate-100 p-1 w-fit overflow-x-auto">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium whitespace-nowrap transition-colors ${
              tab === t.id
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-800'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'profile' && (
        <div className="space-y-6">
          <ProfileTab profile={profile} />
          <div>
            <p className="text-sm font-medium text-slate-700 mb-3">Race info (from active plan)</p>
            <RaceInfoSection plan={activePlan} />
          </div>
        </div>
      )}
      {tab === 'integrations' && <IntegrationsTab />}
      {tab === 'sharing' && <SharingTab />}
      {tab === 'data' && <DataTab email={profile.email} />}
    </div>
  );
}
