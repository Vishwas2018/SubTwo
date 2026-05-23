import { createServiceClient } from '@/lib/supabase/server';
import type { Json } from '@/types/database.types';

type LogAuditParams = {
  action: string;
  entityType?: string;
  entityId?: string;
  userId?: string;
  metadata?: Record<string, unknown>;
};

export async function logAudit({
  action,
  entityType,
  entityId,
  userId,
  metadata,
}: LogAuditParams): Promise<void> {
  try {
    const svc = createServiceClient();
    await svc.from('audit_log').insert({
      action,
      entity_type: entityType ?? null,
      entity_id: entityId ?? null,
      user_id: userId ?? null,
      metadata: (metadata ?? null) as Json | null,
    });
  } catch {
    // Audit log is best-effort; never throw
  }
}
