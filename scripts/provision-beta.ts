#!/usr/bin/env tsx
/**
 * Admin script: provision beta wave — insert invite codes then bulk-create users.
 * Bypasses the public signup route (no rate limiting), operates directly via service role.
 *
 * Usage: pnpm tsx scripts/provision-beta.ts
 * Reads:  docs/BETA_USERS.csv
 * Writes: docs/BETA_CREDS.md
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

import * as fs from 'fs';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
const APP_URL = (process.env.NEXT_PUBLIC_APP_URL ?? 'https://subtwo.vercel.app').replace(/\/$/, '');

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const CSV_PATH = path.join(__dirname, '..', 'docs', 'BETA_USERS.csv');
const CREDS_PATH = path.join(__dirname, '..', 'docs', 'BETA_CREDS.md');

interface Row { email: string; password: string; invite_code: string; }

function parseCSV(content: string): Row[] {
  const lines = content.trim().split('\n');
  const header = lines[0]!.split(',').map(h => h.trim().toLowerCase());
  const ei = header.indexOf('email');
  const pi = header.indexOf('password');
  const ci = header.indexOf('invite_code');
  return lines.slice(1).filter(l => l.trim()).map((line, i) => {
    const cols = line.split(',').map(c => c.trim());
    const email = cols[ei]?.trim() ?? '';
    const password = cols[pi]?.trim() ?? '';
    const invite_code = cols[ci]?.trim().toUpperCase() ?? '';
    if (!email || !password || !invite_code) throw new Error(`Row ${i + 2}: missing field`);
    return { email, password, invite_code };
  });
}

async function main() {
  const rows = parseCSV(fs.readFileSync(CSV_PATH, 'utf-8'));
  console.log(`\nProvisioning ${rows.length} beta users on ${APP_URL}\n`);

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // ── Step 1: Upsert invite codes ──────────────────────────────────────────────
  console.log('1. Upserting invite codes into invite_codes table…');
  const { error: upsertErr } = await admin.from('invite_codes').upsert(
    rows.map(r => ({
      code: r.invite_code,
      max_uses: 1,
      use_count: 0,
      note: 'Beta wave 1',
    })),
    { onConflict: 'code', ignoreDuplicates: true },
  );
  if (upsertErr) {
    console.error('  ✗ Failed to upsert codes:', upsertErr.message);
    process.exit(1);
  }
  console.log(`  ✓ ${rows.length} codes ready\n`);

  // ── Step 2: Create users directly via admin API ──────────────────────────────
  console.log('2. Creating users…');

  type Status = 'created' | 'exists' | 'failed';
  const results: { email: string; status: Status; error?: string }[] = [];

  for (const row of rows) {
    process.stdout.write(`  ${row.email} … `);

    const { error: createErr } = await admin.auth.admin.createUser({
      email: row.email,
      password: row.password,
      email_confirm: true,
    });

    if (!createErr) {
      // Mark invite code as consumed
      await admin.from('invite_codes')
        .update({ use_count: 1 })
        .eq('code', row.invite_code);
      console.log('✓ created');
      results.push({ email: row.email, status: 'created' });
    } else if (
      createErr.message?.toLowerCase().includes('already registered') ||
      createErr.message?.toLowerCase().includes('already exists') ||
      (createErr as { status?: number }).status === 422
    ) {
      console.log('~ already exists');
      results.push({ email: row.email, status: 'exists' });
    } else {
      console.log(`✗ ${createErr.message}`);
      results.push({ email: row.email, status: 'failed', error: createErr.message });
    }
  }

  // ── Step 3: Write BETA_CREDS.md ──────────────────────────────────────────────
  const credsLines = [
    '# Beta Credentials — Wave 1',
    '',
    `Generated: ${new Date().toISOString()}`,
    '',
    '> **Keep this file private.** Send credentials directly to testers via secure channel.',
    '',
    '## Signup URL',
    '',
    `${APP_URL}/signup`,
    '',
    '## Accounts',
    '',
  ];

  for (const row of rows) {
    const result = results.find(r => r.email === row.email);
    if (result?.status === 'created' || result?.status === 'exists') {
      credsLines.push(`| ${row.email} | \`${row.password}\` | \`${row.invite_code}\` |`);
    }
  }

  const failed = results.filter(r => r.status === 'failed');
  if (failed.length) {
    credsLines.push('', '## Failed', '');
    for (const f of failed) credsLines.push(`- ${f.email}: ${f.error}`);
  }

  fs.writeFileSync(CREDS_PATH, credsLines.join('\n') + '\n', 'utf-8');

  const created = results.filter(r => r.status === 'created').length;
  const existed = results.filter(r => r.status === 'exists').length;
  console.log(`\nSummary: ${created} created, ${existed} already existed, ${failed.length} failed`);
  console.log(`Credentials → ${CREDS_PATH}`);

  if (failed.length) process.exit(1);
}

main().catch(err => { console.error(err); process.exit(1); });
