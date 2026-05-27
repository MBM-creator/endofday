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
import { linkJobNoteAttachmentContext } from '@/lib/context-links';

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
  const expectedPrefix = `jobs/`;
  const expectedNoteSegment = `/notes/${noteId}/videos/`;

  if (!storagePath.startsWith(expectedPrefix) || !storagePath.includes(expectedNoteSegment)) {
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

  const { data: note, error: noteError } = await supabaseAdmin
    .from('job_notes')
    .select('id, job_id, stage_id, report_date, primary_context_type, primary_context_id')
    .eq('id', noteId)
    .eq('job_id', jobId)
    .is('deleted_at', null)
    .single();

  if (noteError || !note) return jsonError('Note not found', 404, requestId);

  const exists = await storageObjectExists(storagePath);
  if (!exists) return jsonError('Uploaded video was not found. Please try again.', 400, requestId);

  const { data: attachment, error: insertError } = await supabaseAdmin
    .from('job_note_attachments')
    .insert({
      note_id: noteId,
      job_id: jobId,
      storage_path: storagePath,
      media_type: 'video',
      mime_type: mimeType,
      file_name: fileName,
      file_size_bytes: Math.round(fileSizeBytes),
      duration_seconds: durationSeconds != null && Number.isFinite(durationSeconds) ? durationSeconds : null,
      uploaded_by: staffAuth.staff.id,
      primary_context_type: note.primary_context_type ?? 'job_note',
      primary_context_id: note.primary_context_id ?? noteId,
    })
    .select('id, note_id, job_id, storage_path, media_type, mime_type, file_name, file_size_bytes, duration_seconds, created_at')
    .single();

  if (insertError || !attachment) {
    const supabaseErr = normalizeSupabaseError(insertError ?? null);
    console.error('[job note attachment complete] insert failed:', { requestId, supabaseError: supabaseErr });
    await supabaseAdmin.storage.from(BUCKET).remove([storagePath]);
    return serverError(requestId, supabaseErr.code ?? 'NOTE_ATTACHMENT_INSERT', 'Failed to save video');
  }

  try {
    await linkJobNoteAttachmentContext({
      attachmentId: attachment.id,
      noteId,
      organisationId: validation.organisationId,
      jobId,
      stageId: note.stage_id ?? null,
      reportDate: note.report_date ?? null,
      staffProfileId: staffAuth.staff.id,
    });
  } catch (linkError) {
    console.error('[job note attachment complete] context link failed:', { requestId, linkError });
  }

  const res = NextResponse.json({ ok: true, attachment }, { status: 201 });
  res.headers.set('x-request-id', requestId);
  return res;
}
