import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { guardStaffApi } from '@/lib/guard-staff-api';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { validateJobForOrg, isValidUuid } from '@/lib/job-org-validation';
import {
  JOB_NOTE_VIDEO_MAX_BYTES,
  JOB_NOTE_VIDEO_MAX_SECONDS,
  isAllowedJobNoteVideoMimeType,
} from '@/lib/job-notes';
import { qaSignOffVideoStoragePath } from '@/lib/storage-paths';
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
    .select('id, job_id, qa_type, status')
    .eq('id', runId)
    .eq('job_id', jobId)
    .single();

  if (runError || !run || run.qa_type !== 'sign_off') {
    return jsonError('Sign-off run not found', 404, requestId);
  }

  let body: { fileName?: unknown; mimeType?: unknown; fileSizeBytes?: unknown; durationSeconds?: unknown };
  try {
    const raw = await request.json();
    body = typeof raw === 'object' && raw !== null ? raw : {};
  } catch {
    return jsonError('Invalid JSON body', 400, requestId);
  }

  const fileName = String(body.fileName ?? 'video').trim() || 'video';
  const mimeType = String(body.mimeType ?? '').trim().toLowerCase();
  const fileSizeBytes = Number(body.fileSizeBytes);
  const durationSeconds = body.durationSeconds == null ? null : Number(body.durationSeconds);

  if (!isAllowedJobNoteVideoMimeType(mimeType)) {
    return jsonError('Video must be MP4, MOV, or WebM', 400, requestId);
  }
  if (!Number.isFinite(fileSizeBytes) || fileSizeBytes <= 0 || fileSizeBytes > JOB_NOTE_VIDEO_MAX_BYTES) {
    return jsonError('Video must be 50MB or smaller', 400, requestId);
  }
  if (durationSeconds != null && Number.isFinite(durationSeconds) && durationSeconds > JOB_NOTE_VIDEO_MAX_SECONDS + 1) {
    return jsonError('Video must be 60 seconds or shorter', 400, requestId);
  }

  const { data: existingVideo } = await supabaseAdmin
    .from('paving_qa_photos')
    .select('id')
    .eq('run_id', runId)
    .eq('section_code', sectionCode)
    .eq('item_key', SIGNOFF_SETUP_VIDEO_ITEM)
    .limit(1)
    .maybeSingle();

  if (existingVideo) {
    return jsonError('This sign-off already has a completion video', 400, requestId);
  }

  const storagePath = qaSignOffVideoStoragePath(
    jobId,
    validation.job.name,
    runId,
    sectionCode,
    SIGNOFF_SETUP_VIDEO_ITEM,
    mimeType,
    fileName
  );

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey) {
    return serverError(requestId, 'SUPABASE_PUBLIC_ENV', 'Supabase public environment variables are missing');
  }

  const res = NextResponse.json({
    ok: true,
    upload: {
      endpoint: `${supabaseUrl.replace(/\/$/, '')}/storage/v1/upload/resumable`,
      bucket: BUCKET,
      path: storagePath,
      metadata: {
        bucketName: BUCKET,
        objectName: storagePath,
        contentType: mimeType,
        cacheControl: '3600',
      },
      headers: {
        apikey: anonKey,
      },
    },
  });
  res.headers.set('x-request-id', requestId);
  return res;
}
