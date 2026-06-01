#!/usr/bin/env tsx
/**
 * Admin script: bulk-create beta users from docs/BETA_USERS.csv
 *
 * CSV format (header required):
 *   email,password,invite_code
 *
 * Usage:
 *   pnpm tsx scripts/create-beta-users.ts
 *
 * Reads:   docs/BETA_USERS.csv
 * Writes:  docs/BETA_CREDS.md  (created credentials log — keep private)
 *
 * Requires env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 * Optional:     APP_URL (defaults to http://localhost:3000)
 */

import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_KEY;
const APP_URL = process.env.APP_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
const CSV_PATH = path.join(process.cwd(), 'docs', 'BETA_USERS.csv');
const CREDS_PATH = path.join(process.cwd(), 'docs', 'BETA_CREDS.md');

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Error: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.');
  process.exit(1);
}

if (!fs.existsSync(CSV_PATH)) {
  console.error(`Error: ${CSV_PATH} not found.`);
  console.error('Create docs/BETA_USERS.csv with columns: email,password,invite_code');
  process.exit(1);
}

interface Row {
  email: string;
  password: string;
  invite_code: string;
}

function parseCSV(content: string): Row[] {
  const lines = content.trim().split('\n');
  const header = lines[0]?.split(',').map((h) => h.trim().toLowerCase());
  if (!header?.includes('email') || !header.includes('password') || !header.includes('invite_code')) {
    throw new Error('CSV must have columns: email, password, invite_code');
  }
  const emailIdx = header.indexOf('email');
  const passIdx = header.indexOf('password');
  const codeIdx = header.indexOf('invite_code');

  return lines.slice(1).filter((l) => l.trim()).map((line, i) => {
    const cols = line.split(',').map((c) => c.trim());
    const email = cols[emailIdx]?.trim();
    const password = cols[passIdx]?.trim();
    const invite_code = cols[codeIdx]?.trim().toUpperCase();
    if (!email || !password || !invite_code) {
      throw new Error(`Row ${i + 2}: missing email, password, or invite_code`);
    }
    return { email, password, invite_code };
  });
}

interface Result {
  email: string;
  status: 'created' | 'exists' | 'failed';
  error?: string;
}

async function main() {
  const csv = fs.readFileSync(CSV_PATH, 'utf-8');
  let rows: Row[];
  try {
    rows = parseCSV(csv);
  } catch (err) {
    console.error(`CSV parse error: ${(err as Error).message}`);
    process.exit(1);
  }

  console.log(`Found ${rows.length} user(s) to create.\n`);

  const admin = createClient(SUPABASE_URL!, SERVICE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const results: Result[] = [];

  for (const row of rows) {
    process.stdout.write(`  ${row.email} ... `);

    // Call the signup route so invite validation runs through the same path
    const res = await fetch(`${APP_URL}/api/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(row),
    });

    if (res.status === 201) {
      console.log('✓ created');
      results.push({ email: row.email, status: 'created' });
    } else if (res.status === 409) {
      console.log('~ already exists');
      results.push({ email: row.email, status: 'exists' });
    } else {
      const body = await res.json().catch(() => ({})) as { error?: { message?: string } };
      const msg = body?.error?.message ?? `HTTP ${res.status}`;
      console.log(`✗ ${msg}`);
      results.push({ email: row.email, status: 'failed', error: msg });
    }
  }

  // Write credentials log
  const created = results.filter((r) => r.status === 'created');
  const failed = results.filter((r) => r.status === 'failed');

  const credsLines = [
    '# Beta Credentials',
    '',
    `Generated: ${new Date().toISOString()}`,
    '',
    '> **Keep this file private.** Send credentials directly to testers via secure channel.',
    '',
    '## Accounts',
    '',
  ];

  for (const row of rows) {
    const result = results.find((r) => r.email === row.email);
    if (result?.status === 'created' || result?.status === 'exists') {
      credsLines.push(`- **${row.email}** — password: \`${row.password}\``);
    }
  }

  if (failed.length > 0) {
    credsLines.push('', '## Failed', '');
    for (const f of failed) {
      credsLines.push(`- ${f.email}: ${f.error}`);
    }
  }

  fs.writeFileSync(CREDS_PATH, credsLines.join('\n') + '\n', 'utf-8');

  console.log(`\nSummary: ${created.length} created, ${results.filter(r => r.status === 'exists').length} already existed, ${failed.length} failed.`);
  console.log(`Credentials written to: ${CREDS_PATH}`);

  if (failed.length > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
