import { requireUser } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { SettingsClient } from './settings-client';

export default async function SettingsPage() {
  const user = await requireUser();
  const supabase = await createClient();

  const [profileRes, planRes] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, email, display_name, timezone, ai_generation_count')
      .eq('id', user.id)
      .single(),
    supabase
      .from('plans')
      .select('race_name, race_date, race_distance_km, total_weeks')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .maybeSingle(),
  ]);

  if (!profileRes.data) {
    return (
      <main className="p-8">
        <p className="text-red-600">Failed to load profile.</p>
      </main>
    );
  }

  return (
    <main className="p-4 md:p-8 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Settings</h1>
        <p className="text-sm text-slate-500 mt-1">Manage your profile, data, and integrations.</p>
      </div>

      <SettingsClient
        profile={profileRes.data}
        activePlan={planRes.data ?? null}
      />
    </main>
  );
}
