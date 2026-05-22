import Link from 'next/link';
import { requireUser } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { CheckinForm } from './checkin-form';
import type { CheckinInput } from '@/lib/schemas';

function todayIso(): string {
  return new Date().toISOString().split('T')[0]!;
}

export default async function CheckinPage() {
  const user = await requireUser();
  const today = todayIso();

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from('daily_checkins')
    .select('*')
    .eq('user_id', user.id)
    .eq('checkin_date', today)
    .maybeSingle();

  const prefill: Partial<CheckinInput> | null = existing
    ? {
        checkin_date: existing.checkin_date,
        sleep_hours: existing.sleep_hours ?? undefined,
        resting_hr: existing.resting_hr ?? undefined,
        weight_kg: existing.weight_kg ?? undefined,
        energy_1to5: existing.energy_1to5 ?? undefined,
        mood_1to5: existing.mood_1to5 ?? undefined,
        niggle_today: existing.niggle_today,
        notes: existing.notes ?? undefined,
      }
    : null;

  return (
    <main className="p-4 md:p-8 max-w-xl mx-auto space-y-6">
      <Link href="/plan" className="text-sm text-slate-500 hover:text-slate-700 flex items-center gap-1">
        ← Back to Plan
      </Link>

      <div>
        <h1 className="text-2xl font-bold text-slate-900">Daily Check-in</h1>
        <p className="text-sm text-slate-500 mt-1">
          {today}
          {prefill && (
            <span className="ml-2 text-emerald-600 font-medium">· Already logged — editing</span>
          )}
        </p>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-6">
        <CheckinForm today={today} prefill={prefill} />
      </div>
    </main>
  );
}
