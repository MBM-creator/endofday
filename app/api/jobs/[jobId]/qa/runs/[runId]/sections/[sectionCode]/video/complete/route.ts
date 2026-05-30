import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { guardStaffApi } from '@/lib/guard-staff-api';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { validateJobForOrg, normalizeSupabaseError, isValidUuid } from '@/lib/job-org-validation';
import {
  JOB_NOTE_VIDEO_MAX_BYTES,
  JOB_NOTE_VIDEO_MAX_SECONDS,
  isAllowedJobNoteVideoMimeType,
} from '@/lib/job-notes';
import { isSignoffSectionCode } from '@/lib/signoff-qa-v1-catalog';
import { SIGNOFF_SETUP_VIDEO_ITEM } from '@/lib/signoff-qa-evidence';

export const runtime = 'nodejs';

const BUCKET = 'daily-reports';

function jsonError(message: string, status = 400, requestId?: string) {
  const res = NextResponse.json({ ok: false, message, requestId }, { status });
  if (requestId) res.headers.set('x-request-id', requestId);
  return res;
}

function serverError(requestId: string, errorCode: string, message = 'Internal server error') {
  const res = NextResponse.json({ ok: false, requestId, errorCode, message }, { status: 500 });
  res.headers.set('x-request-id', requestId);
  return res;
}

async function storageObjectExists(path: string): Promise<boolean> {
  const slash = path.lastIndexOf('/');
  if (slash < 0) return false;
  const dir = path.slice(0, slash);
  const file = path.slice(slash + 1);
  const { data, error } = await supabaseAdmin.storage.from(BUCKET).list(dir, { limit: 100 });
  if (error) return false;
  return (data ?? []).some((entry) => entry.name === file);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string; runId: string; sectionCode: string }> }
) {
  const requestId = request.headers.get('x-vercel-id') ?? randomUUID().slice(0, 8);
  const { jobId, runId, sectionCode } = await params;
  const orgSlug = request.nextUrl.searchParams.get('orgSlug')?.trim() ?? '';

  if (!isValidUuid(runId)) return jsonError('Run not found', 404, requestId);
  if (!isSignoffSectionCode(sectionCode)) return jsonError('Unknown sign-off section code', 400, requestId);

  const staffAuth = await guardStaffApi(orgSlug, ['field', 'supervisor', 'admin']);
  if (staffAuth instanceof NextResponse) {
    staffAuth.headers.set('x-request-id', requestId);
    return staffAuth;
  }

  const validation = await validateJobForOrg(jobId, orgSlug, requestId);
  if (validation instanceof NextResponse) return validation;

  const { data: run, error: runError } = await supabaseAdmin
    .from('paving_qa_runs')
    .select('id, job_id, qa_type')
    .eq('id', runId)
    .eq('job_id', jobId)
    .single();

  if (runError || !run || run.qa_type !== 'sign_off') {
    return jsonError('Sign-off run not found', 404, requestId);
  }

  let body: {
    storagePath?: unknown;
    fileName?: unknown;
    mimeType?: unknown;
    fileSizeBytes?: unknown;
    durationSeconds?: unknown;
  };
  try {
    const raw = await request.json();
    body = typeof raw === 'object' && raw !== null ? raw : {};
  } catch {
    return jsonError('Invalid JSON body', 400, requestId);
  }

  const storagePath = String(body.storagePath ?? '').trim();
  const fileName = String(body.fileName ?? 'video').trim() || 'video';
  const mimeType = String(body.mimeType ?? '').trim().toLowerCase();
  const fileSizeBytes = Number(body.fileSizeBytes);
  const durationSeconds = body.durationSeconds == null ? null : Number(body.durationSeconds);
  const expectedSegment = `/qa/sign-off/${runId}/`;

  if (!storagePath.startsWith('jobs/') || !storagePath.includes(expectedSegment)) {
    return jsonError('Invalid uploaded video path', 400, requestId);
  }
  if (!isAllowedJobNoteVideoMimeType(mimeType)) {
    return jsonError('Video must be MP4, MOV, or WebM', 400, requestId);
  }
  if (!Number.isFinite(fileSizeBytes) || fileSizeBytes <= 0 || fileSizeBytes > JOB_NOTE_VIDEO_MAX_BYTES) {
    return jsonError('Video must be 50MB or smaller', 400, requestId);
  }
  if (durationSeconds != null && Number.isFinite(durationSeconds) && durationSeconds > JOB_NOTE_VIDEO_MAX_SECONDS + 1) {
    return jsonError('Video must be 60 seconds or shorter', 400, requestId);
  }

  const exists = await storageObjectExists(storagePath);
  if (!exists) return jsonError('Uploaded video was not found. Please try again.', 400, requestId);

  const { error: insertError } = await supabaseAdmin.from('paving_qa_photos').insert({
    run_id: runId,
    section_code: sectionCode,
    item_key: SIGNOFF_SETUP_VIDEO_ITEM,
    storage_path: storagePath,
    content_type: mimeType,
    uploaded_by: staffAuth.staff.id,
  });

  if (insertError) {
    const supabaseErr = normalizeSupabaseError(insertError);
    console.error('[sign-off video complete] insert failed:', { requestId, supabaseError: supabaseErr });
    await supabaseAdmin.storage.from(BUCKET).remove([storagePath]);
    return serverError(requestId, supabaseErr.code ?? 'SIGNOFF_VIDEO_INSERT', 'Failed to save video');
  }

  await supabaseAdmin.from('paving_qa_runs').update({ updated_at: new Date().toISOString() }).eq('id', runId);

  const res = NextResponse.json({ ok: true, fileName, storagePath }, { status: 201 });
  res.headers.set('x-request-id', requestId);
  return res;
}
