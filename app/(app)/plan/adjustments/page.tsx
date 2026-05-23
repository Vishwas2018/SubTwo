/**
 * /plan/adjustments — List automatic adjustments applied to the active plan.
 * Users can revert individual adjustments here.
 * Refs: P3-04, UI §16
 */

import { redirect } from 'next/navigation';
import Link from 'next/link';
import { requireUser } from '@/lib/auth/session';
import { createServiceClient } from '@/lib/supabase/server';
import { createClient } from '@/lib/supabase/server';
import AdjustmentsClient from './adjustments-client';

export default async function AdjustmentsPage() {
  const user = await requireUser();
  const supabase = await createClient();

  // Active plan
  const { data: plan } = await supabase
    .from('plans')
    .select('id, race_name, race_date, status')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .maybeSingle();

  if (!plan) {
    redirect('/plan');
  }

  const svc = createServiceClient();
  const { data: adjustments } = await svc
    .from('plan_adjustments')
    .select('id, trigger, change_summary, change_details, affected_session_ids, user_override, created_at')
    .eq('plan_id', plan.id)
    .order('created_at', { ascending: false });

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Plan Adjustments</h1>
          <p className="mt-1 text-sm text-gray-500">
            {plan.race_name ?? 'Race'} · {plan.race_date}
          </p>
        </div>
        <Link href="/plan" className="text-sm text-blue-600 hover:underline">
          ← Back to plan
        </Link>
      </div>

      <AdjustmentsClient planId={plan.id} adjustments={adjustments ?? []} />
    </main>
  );
}
