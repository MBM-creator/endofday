/**
 * Supabase Storage path helpers (bucket: daily-reports).
 * Daily report folders use Australia/Sydney calendar date for grouping.
 */

import { randomUUID } from 'crypto';

const SITE_SLUG_MAX = 80;

/**
 * Object key suffix for uploaded photos. Browser `File` names are often unusable
 * (e.g. "blob" with no real extension). Use `.jpg` keys and set `Content-Type` on upload.
 */
export function newImageStorageFileName(): string {
  return `${randomUUID()}.jpg`;
}

/** Calendar date in Australia/Sydney (YYYY-MM-DD) for report filing day. */
export function formatReportDate(submittedAt: Date | string): string {
  const d = typeof submittedAt === 'string' ? new Date(submittedAt) : submittedAt;
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Australia/Sydney',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

/** Safe single path segment for storage keys (lowercase, hyphens, max length). */
export function slugifyPathSegment(raw: string, maxLen = SITE_SLUG_MAX): string {
  const s = raw
    .trim()
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-+/g, '-')
    .slice(0, maxLen)
    .replace(/-+$/g, '');
  return s || 'unknown';
}

/**
 * Final path for a daily report photo after submit (or legacy upload).
 * e.g. madebymobbs/2026-04-16/north-site-024/a1b2c3d4-....jpg
 */
export function dailyReportPhotoStoragePath(
  orgSlug: string,
  siteIdentifier: string,
  submittedAt: Date | string,
  fileName: string
): string {
  const date = formatReportDate(submittedAt);
  const siteSlug = slugifyPathSegment(siteIdentifier);
  return `${orgSlug}/${date}/${siteSlug}/${fileName}`;
}

/**
 * Pre-commencement photo path. jobId disambiguates duplicate or renamed job titles.
 */
export function jobPreCommencementStoragePath(
  jobId: string,
  jobName: string,
  fileName: string
): string {
  const short = jobId.replace(/-/g, '').slice(0, 8);
  const nameSlug = slugifyPathSegment(jobName);
  return `jobs/${nameSlug}__${short}/pre-commencement/${fileName}`;
}

/** Single stable segment for QA paths: slug + short job id (matches pre-commencement style). */
export function jobSlugOrIdSegment(jobId: string, jobName: string): string {
  const short = jobId.replace(/-/g, '').slice(0, 8);
  const nameSlug = slugifyPathSegment(jobName);
  return `${nameSlug}__${short}`;
}

/**
 * Paving QA evidence photos — bucket `daily-reports`, QA-only prefix.
 * jobs/{jobSlugOrId}/qa/{runId}/{sectionCode}/{itemKey}/{uuid}.jpg
 */
export function pavingQaPhotoStoragePath(
  jobId: string,
  jobName: string,
  runId: string,
  sectionCode: string,
  itemKey: string,
  fileName: string
): string {
  const seg = jobSlugOrIdSegment(jobId, jobName);
  const sec = slugifyPathSegment(sectionCode, 64);
  const item = slugifyPathSegment(itemKey, 64);
  return `jobs/${seg}/qa/${runId}/${sec}/${item}/${fileName}`;
}
