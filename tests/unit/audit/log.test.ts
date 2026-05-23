// Unit tests for lib/audit/log.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockInsert = vi.fn().mockResolvedValue({ error: null });
const mockFrom = vi.fn(() => ({ insert: mockInsert }));

vi.mock('@/lib/supabase/server', () => ({
  createServiceClient: () => ({ from: mockFrom }),
}));

const { logAudit } = await import('@/lib/audit/log');

describe('logAudit', () => {
  beforeEach(() => {
    mockInsert.mockClear();
    mockFrom.mockClear();
  });

  it('inserts a row into audit_log', async () => {
    await logAudit({ action: 'test_action' });
    expect(mockFrom).toHaveBeenCalledWith('audit_log');
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'test_action' }),
    );
  });

  it('passes optional fields through', async () => {
    await logAudit({
      action: 'user_suspended',
      entityType: 'profiles',
      entityId: 'u-1',
      userId: 'admin-1',
      metadata: { reason: 'spam' },
    });
    expect(mockInsert).toHaveBeenCalledWith({
      action: 'user_suspended',
      entity_type: 'profiles',
      entity_id: 'u-1',
      user_id: 'admin-1',
      metadata: { reason: 'spam' },
    });
  });

  it('does not throw when insert fails', async () => {
    mockInsert.mockRejectedValueOnce(new Error('db error'));
    await expect(logAudit({ action: 'whatever' })).resolves.toBeUndefined();
  });

  it('sends null for omitted optional fields', async () => {
    await logAudit({ action: 'minimal' });
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        entity_type: null,
        entity_id: null,
        user_id: null,
        metadata: null,
      }),
    );
  });
});
