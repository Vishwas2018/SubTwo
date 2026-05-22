import Link from 'next/link';
import { requireUser } from '@/lib/auth/session';
import { createClient } from '@/lib/supabase/server';
import { CheckpointsList } from './checkpoints-client';

type CheckpointSpec = {
  week: number;
  type: string;
  target_seconds: number;
  target_distance_km: number;
};

type RawCheckpointsJson = {
  checkpoints?: CheckpointSpec[];
};

function parseSpecs(raw: unknown): CheckpointSpec[] {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return [];
  const obj = raw as Record<string, unknown>;
  if (!Array.isArray(obj['checkpoints'])) return [];
  return (obj['checkpoints'] as unknown[]).filter(
    (c): c is CheckpointSpec =>
      !!c &&
      typeof c === 'object' &&
      typeof (c as Record<string, unknown>)['week'] === 'number' &&
      typeof (c as Record<string, unknown>)['type'] === 'string' &&
      typeof (c as Record<string, unknown>)['target_seconds'] === 'number' &&
      typeof (c as Record<string, unknown>)['target_distance_km'] === 'number',
  );
}

export default async function CheckpointsPage() {
  const user = await requireUser();
  const supabase = await createClient();

  const { data: plan } = await supabase
    .from('plans')
    .select('id, race_name, race_date, total_weeks, current_version_id')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .maybeSingle();

  if (!plan) {
    return (
      <main className="p-4 md:p-8 max-w-2xl mx-auto space-y-6">
        <Link href="/plan" className="text-sm text-slate-500 hover:text-slate-700 flex items-center gap-1">
          ← Back to Plan
        </Link>
        <h1 className="text-2xl font-bold text-slate-900">Checkpoints</h1>
        <div className="rounded-lg border border-slate-200 bg-white p-8 text-center space-y-3">
          <p className="text-slate-500">No active plan found.</p>
          <p className="text-slate-400 text-sm">Create a training plan to see your checkpoints.</p>
          <Link
            href="/onboarding/wizard"
            className="inline-block mt-2 px-5 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700"
          >
            Start Wizard
          </Link>
        </div>
      </main>
    );
  }

  let specs: CheckpointSpec[] = [];
  if (plan.current_version_id) {
    const { data: version } = await supabase
      .from('plan_versions')
      .select('raw_plan_json')
      .eq('id', plan.current_version_id)
      .single();
    if (version) {
      specs = parseSpecs(version.raw_plan_json as RawCheckpointsJson);
    }
  }

  const { data: completed } = await supabase
    .from('checkpoints')
    .select('*')
    .eq('plan_id', plan.id)
    .order('created_at', { ascending: false });

  const items = specs.map((spec) => ({
    spec,
    completed: (completed ?? []).find((c) => c.checkpoint_type === spec.type) ?? null,
  }));

  const pendingCount = items.filter((i) => !i.completed).length;
  const doneCount = items.filter((i) => i.completed).length;

  return (
    <main className="p-4 md:p-8 max-w-2xl mx-auto space-y-6">
      <Link href="/plan" className="text-sm text-slate-500 hover:text-slate-700 flex items-center gap-1">
        ← Back to Plan
      </Link>

      <div>
        <h1 className="text-2xl font-bold text-slate-900">Checkpoints</h1>
        <p className="text-sm text-slate-500 mt-1">
          {plan.race_name ?? 'Race'} · {plan.total_weeks} weeks
          {items.length > 0 && (
            <> · <span className="text-emerald-600 font-medium">{doneCount}/{items.length} logged</span>
            {pendingCount > 0 && <span className="text-amber-600 font-medium"> · {pendingCount} pending</span>}
            </>
          )}
        </p>
      </div>

      <CheckpointsList items={items} />
    </main>
  );
}
