/**
 * Rename Storage keys that end with `.blob` to `.jpg` (same path prefix + stem).
 * Updates `daily_report_photos` and `job_pre_commencement_photos` storage_path.
 *
 * Draft uploads under `drafts/<uuid>/` are not in these tables; fix those in the
 * dashboard or by deleting stale drafts if needed.
 *
 * Usage:
 *   npx tsx scripts/fix-blob-photo-extensions.ts --dry-run
 *   npx tsx scripts/fix-blob-photo-extensions.ts
 *
 * Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (e.g. .env.local).
 */

import { config } from 'dotenv';
import { resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';

config({ path: resolve(process.cwd(), '.env') });
config({ path: resolve(process.cwd(), '.env.local'), override: true });

const BUCKET = 'daily-reports';

function storageErrorMessage(err: unknown): string {
  if (err === null || err === undefined) return '';
  if (typeof err === 'object' && 'message' in err && typeof (err as { message: unknown }).message === 'string') {
    return (err as { message: string }).message;
  }
  return String(err);
}

function isObjectNotFoundError(err: unknown): boolean {
  const m = storageErrorMessage(err).toLowerCase();
  return m.includes('not found') || m.includes('does not exist') || m === 'object not found';
}

function newPathFromBlobKey(storagePath: string): string | null {
  if (!/\.blob$/i.test(storagePath)) return null;
  return storagePath.replace(/\.blob$/i, '.jpg');
}

async function fixTable(
  supabase: ReturnType<typeof createClient>,
  table: 'daily_report_photos' | 'job_pre_commencement_photos',
  dryRun: boolean
): Promise<{ ok: number; skip: number; fail: number; missing: number }> {
  let ok = 0;
  let skip = 0;
  let fail = 0;
  let missing = 0;

  const { data: rows, error: fetchError } = await supabase
    .from(table)
    .select('id, storage_path')
    .ilike('storage_path', '%.blob');

  if (fetchError) {
    console.error(`[${table}] fetch failed:`, fetchError.message);
    return { ok: 0, skip: 0, fail: 1, missing: 0 };
  }

  const list = rows ?? [];
  if (list.length === 0) {
    console.log(`[${table}] no rows with .blob suffix`);
    return { ok: 0, skip: 0, fail: 0, missing: 0 };
  }

  for (const row of list) {
    const destPath = newPathFromBlobKey(row.storage_path);
    if (!destPath) {
      skip += 1;
      continue;
    }

    if (dryRun) {
      console.log(`[dry-run] ${table} ${row.id}`);
      console.log('  from:', row.storage_path);
      console.log('  to:  ', destPath);
      ok += 1;
      continue;
    }

    const { error: copyError } = await supabase.storage.from(BUCKET).copy(row.storage_path, destPath);

    if (copyError) {
      if (isObjectNotFoundError(copyError)) {
        missing += 1;
        console.warn(`[${table}] source missing id=${row.id} path=${row.storage_path}`);
        continue;
      }
      console.error(`[${table}] copy failed id=${row.id}: ${storageErrorMessage(copyError)}`);
      fail += 1;
      continue;
    }

    const { error: updateError } = await supabase.from(table).update({ storage_path: destPath }).eq('id', row.id);

    if (updateError) {
      console.error(`[${table}] DB update failed id=${row.id}:`, updateError.message);
      await supabase.storage.from(BUCKET).remove([destPath]);
      fail += 1;
      continue;
    }

    const { error: removeError } = await supabase.storage.from(BUCKET).remove([row.storage_path]);
    if (removeError) {
      console.warn(`[${table}] old key delete failed (new path is live) id=${row.id}:`, removeError.message);
    }

    ok += 1;
  }

  return { ok, skip, fail, missing };
}

async function main(): Promise<void> {
  const dryRun = process.argv.includes('--dry-run');
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY (set in .env.local or environment).');
    process.exit(1);
  }

  const supabase = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  console.log(dryRun ? 'Dry run (no changes).\n' : 'Fixing .blob → .jpg in Storage + DB...\n');

  const daily = await fixTable(supabase, 'daily_report_photos', dryRun);
  console.log(
    '\n[daily_report_photos]',
    dryRun ? 'would fix' : 'fixed',
    daily.ok,
    'skip',
    daily.skip,
    'missing_source',
    daily.missing,
    'fail',
    daily.fail
  );

  const job = await fixTable(supabase, 'job_pre_commencement_photos', dryRun);
  console.log(
    '[job_pre_commencement_photos]',
    dryRun ? 'would fix' : 'fixed',
    job.ok,
    'skip',
    job.skip,
    'missing_source',
    job.missing,
    'fail',
    job.fail
  );

  process.exit(daily.fail + job.fail > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
