/**
 * One-off migration: move Storage objects to human-readable paths and update DB.
 *
 * Usage:
 *   npx tsx scripts/migrate-storage-paths.ts           # run
 *   npx tsx scripts/migrate-storage-paths.ts --dry-run              # log only
 *   npx tsx scripts/migrate-storage-paths.ts --delete-missing-rows  # if copy fails with
 *                                                                    # object not found, delete the DB row
 *
 * Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (e.g. in .env.local).
 */

import { config } from 'dotenv';
import { resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';

import {
  dailyReportPhotoStoragePath,
  jobPreCommencementStoragePath,
} from '../lib/storage-paths';

config({ path: resolve(process.cwd(), '.env') });
config({ path: resolve(process.cwd(), '.env.local'), override: true });

const BUCKET = 'daily-reports';

function parseArgs(): { dryRun: boolean; deleteMissingRows: boolean } {
  const dryRun = process.argv.includes('--dry-run');
  const deleteMissingRows = process.argv.includes('--delete-missing-rows');
  return { dryRun, deleteMissingRows };
}

function storageErrorMessage(err: unknown): string {
  if (err === null || err === undefined) return '';
  if (typeof err === 'object' && 'message' in err && typeof (err as { message: unknown }).message === 'string') {
    return (err as { message: string }).message;
  }
  return String(err);
}

/** Supabase Storage copy/source missing (S3 NoSuchKey-style). */
function isObjectNotFoundError(err: unknown): boolean {
  const m = storageErrorMessage(err).toLowerCase();
  return m.includes('not found') || m.includes('does not exist') || m === 'object not found';
}

function basenameFromPath(storagePath: string): string {
  const parts = storagePath.split('/').filter(Boolean);
  return parts[parts.length - 1] ?? '';
}

async function migrateDailyReportPhotos(
  supabase: ReturnType<typeof createClient>,
  dryRun: boolean,
  deleteMissingRows: boolean
): Promise<{ ok: number; skip: number; fail: number; missing: number }> {
  let ok = 0;
  let skip = 0;
  let fail = 0;
  let missing = 0;

  const { data: rows, error: fetchError } = await supabase
    .from('daily_report_photos')
    .select('id, storage_path, report_id');

  if (fetchError) {
    console.error('[daily_report_photos] fetch failed:', fetchError.message);
    return { ok: 0, skip: 0, fail: 0, missing: 0 };
  }

  const list = rows ?? [];
  if (list.length === 0) {
    console.log('[daily_report_photos] no rows');
    return { ok: 0, skip: 0, fail: 0, missing: 0 };
  }

  const reportIds = [...new Set(list.map((r) => r.report_id))];
  const { data: reports, error: reportsError } = await supabase
    .from('daily_reports')
    .select('id, site_identifier, submitted_at, organisation_id')
    .in('id', reportIds);

  if (reportsError || !reports) {
    console.error('[daily_reports] fetch failed:', reportsError?.message);
    return { ok: 0, skip: 0, fail: 0, missing: 0 };
  }

  const reportMap = new Map(reports.map((r) => [r.id, r]));
  const orgIds = [...new Set(reports.map((r) => r.organisation_id))];
  const { data: orgs, error: orgsError } = await supabase
    .from('organisations')
    .select('id, slug')
    .in('id', orgIds);

  if (orgsError || !orgs) {
    console.error('[organisations] fetch failed:', orgsError?.message);
    return { ok: 0, skip: 0, fail: 0, missing: 0 };
  }

  const orgSlugById = new Map(orgs.map((o) => [o.id, o.slug]));

  for (const row of list) {
    const report = reportMap.get(row.report_id);
    if (!report) {
      console.warn('[daily_report_photos] missing report', row.id, row.report_id);
      fail += 1;
      continue;
    }

    const orgSlug = orgSlugById.get(report.organisation_id);
    if (!orgSlug) {
      console.warn('[daily_report_photos] missing org', row.id, report.organisation_id);
      fail += 1;
      continue;
    }

    const fileName = basenameFromPath(row.storage_path);
    if (!fileName) {
      console.warn('[daily_report_photos] empty filename', row.id, row.storage_path);
      fail += 1;
      continue;
    }

    const newPath = dailyReportPhotoStoragePath(
      orgSlug,
      report.site_identifier,
      report.submitted_at,
      fileName
    );

    if (newPath === row.storage_path) {
      skip += 1;
      continue;
    }

    if (dryRun) {
      console.log('[dry-run] daily_report_photos', row.id);
      console.log('  from:', row.storage_path);
      console.log('  to:  ', newPath);
      ok += 1;
      continue;
    }

    const { error: copyError } = await supabase.storage.from(BUCKET).copy(row.storage_path, newPath);

    if (copyError) {
      if (isObjectNotFoundError(copyError)) {
        missing += 1;
        const msg = `[daily_report_photos] source object missing in Storage (DB path orphaned): id=${row.id} path=${row.storage_path}`;
        if (deleteMissingRows && !dryRun) {
          const { error: delErr } = await supabase.from('daily_report_photos').delete().eq('id', row.id);
          if (delErr) {
            console.error(`${msg} — delete row failed: ${delErr.message}`);
            fail += 1;
          } else {
            console.warn(`${msg} — DB row deleted (--delete-missing-rows)`);
          }
        } else {
          console.warn(
            `${msg}${deleteMissingRows ? '' : ' — re-run with --delete-missing-rows to remove the DB row, or fix the file in Storage manually'}`
          );
        }
        continue;
      }
      console.error(`[daily_report_photos] copy failed id=${row.id}: ${storageErrorMessage(copyError)}`);
      fail += 1;
      continue;
    }

    const { error: updateError } = await supabase
      .from('daily_report_photos')
      .update({ storage_path: newPath })
      .eq('id', row.id);

    if (updateError) {
      console.error('[daily_report_photos] DB update failed', row.id, updateError.message);
      await supabase.storage.from(BUCKET).remove([newPath]);
      fail += 1;
      continue;
    }

    const { error: removeError } = await supabase.storage.from(BUCKET).remove([row.storage_path]);
    if (removeError) {
      console.warn('[daily_report_photos] old delete failed (new path is live)', row.id, removeError.message);
    }

    ok += 1;
  }

  return { ok, skip, fail, missing };
}

async function migrateJobPreCommencementPhotos(
  supabase: ReturnType<typeof createClient>,
  dryRun: boolean,
  deleteMissingRows: boolean
): Promise<{ ok: number; skip: number; fail: number; missing: number }> {
  let ok = 0;
  let skip = 0;
  let fail = 0;
  let missing = 0;

  const { data: rows, error: fetchError } = await supabase
    .from('job_pre_commencement_photos')
    .select('id, storage_path, job_id');

  if (fetchError) {
    console.error('[job_pre_commencement_photos] fetch failed:', fetchError.message);
    return { ok: 0, skip: 0, fail: 0, missing: 0 };
  }

  const list = rows ?? [];
  if (list.length === 0) {
    console.log('[job_pre_commencement_photos] no rows');
    return { ok: 0, skip: 0, fail: 0, missing: 0 };
  }

  const jobIds = [...new Set(list.map((r) => r.job_id))];
  const { data: jobs, error: jobsError } = await supabase.from('jobs').select('id, name').in('id', jobIds);

  if (jobsError || !jobs) {
    console.error('[jobs] fetch failed:', jobsError?.message);
    return { ok: 0, skip: 0, fail: 0, missing: 0 };
  }

  const jobMap = new Map(jobs.map((j) => [j.id, j]));

  for (const row of list) {
    const job = jobMap.get(row.job_id);
    if (!job) {
      console.warn('[job_pre_commencement_photos] missing job', row.id, row.job_id);
      fail += 1;
      continue;
    }

    const fileName = basenameFromPath(row.storage_path);
    if (!fileName) {
      console.warn('[job_pre_commencement_photos] empty filename', row.id, row.storage_path);
      fail += 1;
      continue;
    }

    const newPath = jobPreCommencementStoragePath(row.job_id, job.name, fileName);

    if (newPath === row.storage_path) {
      skip += 1;
      continue;
    }

    if (dryRun) {
      console.log('[dry-run] job_pre_commencement_photos', row.id);
      console.log('  from:', row.storage_path);
      console.log('  to:  ', newPath);
      ok += 1;
      continue;
    }

    const { error: copyError } = await supabase.storage.from(BUCKET).copy(row.storage_path, newPath);

    if (copyError) {
      if (isObjectNotFoundError(copyError)) {
        missing += 1;
        const msg = `[job_pre_commencement_photos] source object missing in Storage: id=${row.id} path=${row.storage_path}`;
        if (deleteMissingRows && !dryRun) {
          const { error: delErr } = await supabase.from('job_pre_commencement_photos').delete().eq('id', row.id);
          if (delErr) {
            console.error(`${msg} — delete row failed: ${delErr.message}`);
            fail += 1;
          } else {
            console.warn(`${msg} — DB row deleted (--delete-missing-rows)`);
          }
        } else {
          console.warn(`${msg} — re-run with --delete-missing-rows to remove the DB row if appropriate`);
        }
        continue;
      }
      console.error(`[job_pre_commencement_photos] copy failed id=${row.id}: ${storageErrorMessage(copyError)}`);
      fail += 1;
      continue;
    }

    const { error: updateError } = await supabase
      .from('job_pre_commencement_photos')
      .update({ storage_path: newPath })
      .eq('id', row.id);

    if (updateError) {
      console.error('[job_pre_commencement_photos] DB update failed', row.id, updateError.message);
      await supabase.storage.from(BUCKET).remove([newPath]);
      fail += 1;
      continue;
    }

    const { error: removeError } = await supabase.storage.from(BUCKET).remove([row.storage_path]);
    if (removeError) {
      console.warn('[job_pre_commencement_photos] old delete failed (new path is live)', row.id, removeError.message);
    }

    ok += 1;
  }

  return { ok, skip, fail, missing };
}

async function main(): Promise<void> {
  const { dryRun, deleteMissingRows } = parseArgs();

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY (set in .env.local or environment).');
    process.exit(1);
  }

  const supabase = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  console.log(dryRun ? 'Dry run (no changes).\n' : 'Migrating storage paths...\n');
  if (deleteMissingRows && dryRun) {
    console.log('Note: --delete-missing-rows has no effect with --dry-run.\n');
  }

  const daily = await migrateDailyReportPhotos(supabase, dryRun, deleteMissingRows);
  console.log(
    '\n[daily_report_photos]',
    dryRun ? 'would migrate' : 'migrated',
    daily.ok,
    'skip',
    daily.skip,
    'missing_source',
    daily.missing,
    'fail',
    daily.fail
  );

  const job = await migrateJobPreCommencementPhotos(supabase, dryRun, deleteMissingRows);
  console.log(
    '[job_pre_commencement_photos]',
    dryRun ? 'would migrate' : 'migrated',
    job.ok,
    'skip',
    job.skip,
    'missing_source',
    job.missing,
    'fail',
    job.fail
  );

  const totalFail = daily.fail + job.fail;
  process.exit(totalFail > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
