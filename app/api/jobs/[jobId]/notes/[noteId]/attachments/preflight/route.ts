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
import { jobNoteVideoStoragePath, newVideoStorageFileName } from '@/lib/storage-paths';

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
  { params }: { params: Promise<{ jobId: string; noteId: string }> }
) {
  const requestId = request.headers.get('x-vercel-id') ?? randomUUID().slice(0, 8);
  const { jobId, noteId } = await params;
  const orgSlug = request.nextUrl.searchParams.get('orgSlug')?.trim() ?? '';

  if (!isValidUuid(noteId)) return jsonError('Note not found', 404, requestId);

  const staffAuth = await guardStaffApi(orgSlug);
  if (staffAuth instanceof NextResponse) {
    staffAuth.headers.set('x-request-id', requestId);
    return staffAuth;
  }

  const validation = await validateJobForOrg(jobId, orgSlug, requestId);
  if (validation instanceof NextResponse) return validation;

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

  const { data: note, error: noteError } = await supabaseAdmin
    .from('job_notes')
    .select('id, job_id')
    .eq('id', noteId)
    .eq('job_id', jobId)
    .is('deleted_at', null)
    .single();

  if (noteError || !note) return jsonError('Note not found', 404, requestId);

  const storageFileName = newVideoStorageFileName(mimeType, fileName);
  const storagePath = jobNoteVideoStoragePath(jobId, validation.job.name, noteId, storageFileName);
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !anonKey) {
    return serverError(requestId, 'SUPABASE_PUBLIC_ENV', 'Supabase public environment variables are missing');
  }

  const { data: existingAttachment, error: existingError } = await supabaseAdmin
    .from('job_note_attachments')
    .select('id')
    .eq('note_id', noteId)
    .is('deleted_at', null)
    .limit(1)
    .maybeSingle();

  if (existingError) {
    const supabaseErr = normalizeSupabaseError(existingError);
    console.error('[job note attachment preflight] existing check failed:', { requestId, supabaseError: supabaseErr });
    return serverError(requestId, supabaseErr.code ?? 'NOTE_ATTACHMENT_CHECK', 'Failed to prepare upload');
  }
  if (existingAttachment) {
    return jsonError('This note already has a video attached', 400, requestId);
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
