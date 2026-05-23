/**
 * P3-02 RLS audit script.
 * Read-only: calls get_rls_audit() and reports. Exits non-zero if any table
 * has RLS disabled or has zero policies.
 */
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env.local') });

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY =
  process.env.SUPABASE_SERVICE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error(
    'Set SUPABASE_URL + SUPABASE_SERVICE_KEY (or NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY)',
  );
  process.exit(1);
}

const IGNORE_TABLES = new Set([
  'schema_migrations',
  'secrets',
  'extensions',
]);

type RlsRow = { table_name: string; rls_enabled: boolean; policy_count: number };

const svc = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

void (async () => {
  const { data, error } = (await svc.rpc('get_rls_audit')) as {
    data: RlsRow[] | null;
    error: { message: string } | null;
  };

  if (error) {
    console.error('get_rls_audit() failed:', error.message);
    process.exit(1);
  }

  const rows = (data ?? []).filter((r) => !IGNORE_TABLES.has(r.table_name));

  let gaps = 0;
  console.log('\nRLS Audit Report\n' + '─'.repeat(60));
  for (const row of rows) {
    const ok = row.rls_enabled && row.policy_count > 0;
    const status = ok ? '✓' : '✗ GAP';
    console.log(
      `${status.padEnd(8)} ${row.table_name.padEnd(32)} rls=${String(row.rls_enabled).padEnd(5)} policies=${row.policy_count}`,
    );
    if (!ok) gaps++;
  }

  console.log('─'.repeat(60));
  if (gaps === 0) {
    console.log(`\nAll ${rows.length} tables have RLS enabled and at least one policy. ✓\n`);
  } else {
    console.error(`\n${gaps} table(s) have RLS gaps. Fix before shipping.\n`);
    process.exit(1);
  }
})();
