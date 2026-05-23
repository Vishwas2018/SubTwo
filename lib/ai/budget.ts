import { createServiceClient } from '@/lib/supabase/server';
import { logAudit } from '@/lib/audit/log';

export type BudgetResult = {
  month_spend: number;
  soft_cap: number;
  hard_cap: number;
  soft_exceeded: boolean;
  hard_exceeded: boolean;
};

export const SOFT_CAP = 50;
export const HARD_CAP = 100;

export async function getMonthlySpend(): Promise<number> {
  const svc = createServiceClient();
  const { data, error } = await svc.rpc('get_monthly_ai_spend');
  if (error) throw new Error(`getMonthlySpend: ${error.message}`);
  return Number(data ?? 0);
}

export async function checkBudget(): Promise<BudgetResult> {
  const svc = createServiceClient();
  const { data, error } = await svc.rpc('check_global_ai_budget', {
    p_soft_cap: SOFT_CAP,
    p_hard_cap: HARD_CAP,
  });
  if (error) throw new Error(`checkBudget: ${error.message}`);
  return data as BudgetResult;
}

export async function maybySendBudgetAlert(
  level: 'soft' | 'hard',
  monthSpend: number,
): Promise<void> {
  const svc = createServiceClient();

  // Atomically claim the alert slot — only first caller this month sends it
  const { data: claimed, error: claimErr } = await svc.rpc('try_claim_budget_alert', {
    p_level: level,
  });
  if (claimErr || !claimed) return;

  const adminEmail = process.env.INITIAL_ADMIN_EMAIL ?? 'jvishu21@gmail.com';
  const capValue = level === 'soft' ? SOFT_CAP : HARD_CAP;
  const subject =
    level === 'soft'
      ? `SubTwo: AI budget soft cap reached ($${capValue})`
      : `SubTwo: AI budget HARD cap reached ($${capValue}) — generation blocked`;
  const body =
    `Monthly AI spend has reached $${monthSpend.toFixed(4)}, crossing the ${level} cap of $${capValue}. ` +
    (level === 'hard'
      ? 'AI generation is now blocked until next month.'
      : 'AI generation is still allowed but approaching the hard cap.');

  await logAudit({
    action: `ai_budget_${level}_cap_alert`,
    entityType: 'ai_budget',
    metadata: { month_spend: monthSpend, cap: capValue, level },
  });

  if (!process.env.RESEND_API_KEY) return;

  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'SubTwo <alerts@subtwo.app>',
        to: adminEmail,
        subject,
        text: body,
      }),
    });
  } catch {
    // Email is best-effort; audit_log entry is the authoritative record
  }
}
