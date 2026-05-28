import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { validateJobForOrg, normalizeSupabaseError, isValidUuid } from '@/lib/job-org-validation';
import { guardStaffApi } from '@/lib/guard-staff-api';
import { randomUUID } from 'crypto';

export const runtime = 'nodejs';

const BUCKET = 'daily-reports';
/** Signed URL TTL in seconds. 1 hour covers a normal review session. */
const SIGNED_URL_EXPIRY_SECS = 3600;

function jsonError(message: string, status = 400, requestId?: string) {
  const res = NextResponse.json({ ok: false, message }, { status });
  if (requestId) res.headers.set('x-request-id', requestId);
  return res;
}

function serverError(requestId: string, message = 'Internal server error') {
  const res = NextResponse.json({ ok: false, requestId, message }, { status: 500 });
  res.headers.set('x-request-id', requestId);
  return res;
}

/**
 * GET /api/jobs/[jobId]/qa/runs/[runId]/sections/[sectionCode]/photos?orgSlug=...
 *
 * Returns signed image URLs for all photos saved for a specific run section.
 * Signed URLs expire after 1 hour. Access is gated by normal staff auth checks.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string; runId: string; sectionCode: string }> }
) {
  const requestId = request.headers.get('x-vercel-id') ?? randomUUID().slice(0, 8);
  const { jobId, runId, sectionCode: sectionCodeParam } = await params;
  const orgSlug = request.nextUrl.searchParams.get('orgSlug')?.trim() ?? '';

  // Auth: any valid staff member for the org may view evidence
  const staffAuth = await guardStaffApi(orgSlug);
  if (staffAuth instanceof NextResponse) {
    staffAuth.headers.set('x-request-id', requestId);
    return staffAuth;
  }

  if (!isValidUuid(runId)) return jsonError('Run not found', 404, requestId);

  const v = await validateJobForOrg(jobId, orgSlug, requestId);
  if (v instanceof NextResponse) {
    v.headers.set('x-request-id', requestId);
    return v;
  }

  // Confirm the run belongs to this job before returning any photo URLs
  const { data: run } = await supabaseAdmin
    .from('paving_qa_runs')
    .select('id')
    .eq('id', runId)
    .eq('job_id', jobId)
    .maybeSingle();

  if (!run) return jsonError('Run not found', 404, requestId);

  const sectionCode = decodeURIComponent(sectionCodeParam);

  // Fetch photo rows for this run + section, ordered by upload time
  const { data: photoRows, error: photoErr } = await supabaseAdmin
    .from('paving_qa_photos')
    .select('id, item_key, storage_path, content_type, created_at')
    .eq('run_id', runId)
    .eq('section_code', sectionCode)
    .order('created_at', { ascending: true });

  if (photoErr) {
    console.error('[qa/section/photos GET]', { requestId, error: normalizeSupabaseError(photoErr) });
    return serverError(requestId, 'Failed to load photos');
  }

  const rows = photoRows ?? [];

  if (rows.length === 0) {
    const res = NextResponse.json({ ok: true, photos: [] });
    res.headers.set('x-request-id', requestId);
    return res;
  }

  // Batch-generate signed URLs in a single storage call
  const paths = rows.map((r) => r.storage_path as string);
  const { data: signedData, error: signErr } = await supabaseAdmin.storage
    .from(BUCKET)
    .createSignedUrls(paths, SIGNED_URL_EXPIRY_SECS);

  if (signErr) {
    console.error('[qa/section/photos GET] sign', { requestId, error: signErr.message });
    return serverError(requestId, 'Failed to generate photo URLs');
  }

  // Map path → signedUrl for O(1) lookup
  const signedMap = new Map<string, string>();
  for (const s of signedData ?? []) {
    if (s.path && s.signedUrl) {
      signedMap.set(s.path, s.signedUrl);
    }
  }

  const photos = rows.map((r) => ({
    id: r.id as string,
    item_key: r.item_key as string,
    content_type: (r.content_type as string) || 'image/jpeg',
    created_at: (r.created_at as string | null) ?? null,
    signed_url: signedMap.get(r.storage_path as string) ?? null,
  }));

  const res = NextResponse.json({ ok: true, photos });
  res.headers.set('x-request-id', requestId);
  return res;
}
