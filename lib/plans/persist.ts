import { createServiceClient } from '@/lib/supabase/server';
import type { GeneratedPlan } from '@/lib/schemas/plan';
import type { WizardInput } from '@/lib/schemas';

export type PersistPlanArgs = {
  userId: string;
  wizardInput: WizardInput;
  generated: GeneratedPlan;
  generationId: string;
};

export type PersistedPlan = { planId: string; versionId: string; sessionCount: number };

// Minimal interface for RPCs not yet in generated database types (migration 020)
interface UntypedRpc {
  rpc(
    fn: string,
    args: Record<string, unknown>,
  ): Promise<{ data: unknown; error: { message: string } | null }>;
}

/**
 * Derives the scheduled date for a session given the plan start date,
 * 1-based week number, and 1-based day of week (1=Mon, 7=Sun).
 */
export function computeScheduledDate(startDate: Date, weekNumber: number, dayOfWeek: number): Date {
  const offset = (weekNumber - 1) * 7 + (dayOfWeek - 1);
  const d = new Date(startDate);
  d.setUTCDate(d.getUTCDate() + offset);
  return d;
}

/**
 * Atomically persist a generated plan via the create_plan_from_generation RPC.
 * Returns the new plan_id, version_id, and session count.
 */
export async function persistGeneratedPlan(args: PersistPlanArgs): Promise<PersistedPlan> {
  const { userId, wizardInput, generated, generationId } = args;

  // Cast to untyped RPC interface — create_plan_from_generation was added in migration 020
  // and the generated types (types/database.types.ts) predate it.
  const client = createServiceClient() as unknown as UntypedRpc;

  const { data, error } = await client.rpc('create_plan_from_generation', {
    p_user_id: userId,
    p_plan: generated as unknown as Record<string, unknown>,
    p_wizard: wizardInput as unknown as Record<string, unknown>,
    p_generation_id: generationId,
  });

  if (error) {
    throw new Error(`Plan persistence failed: ${error.message}`);
  }

  const result = data as { plan_id: string; version_id: string; session_count: number };
  return {
    planId: result.plan_id,
    versionId: result.version_id,
    sessionCount: result.session_count,
  };
}
