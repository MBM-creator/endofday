import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { guardStaffApi } from '@/lib/guard-staff-api';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { validateJobForOrg, normalizeSupabaseError, isValidUuid } from '@/lib/job-org-validation';
import {
  JOB_NOTE_IMAGE_MAX_BYTES,
  JOB_NOTE_IMAGE_MAX_PER_NOTE,
  isAllowedJobNoteImageMimeType,
} from '@/lib/job-notes';
import { jobNoteImageStoragePath, newImageStorageFileName } from '@/lib/storage-paths';
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

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return jsonError('Failed to parse upload', 400, requestId);
  }

  const file = formData.get('file') ?? formData.get('photo') ?? formData.get('image');
  if (!file || !(file instanceof File) || file.size === 0) {
    return jsonError('One image file is required', 400, requestId);
  }

  const mimeType = (file.type || 'image/jpeg').toLowerCase();
  if (!isAllowedJobNoteImageMimeType(mimeType)) {
    return jsonError('Image must be JPEG, PNG, or WebP', 400, requestId);
  }
  if (file.size > JOB_NOTE_IMAGE_MAX_BYTES) {
    return jsonError('Image must be 10MB or smaller', 400, requestId);
  }

  const { data: note, error: noteError } = await supabaseAdmin
    .from('job_notes')
    .select('id, job_id, stage_id, report_date, primary_context_type, primary_context_id')
    .eq('id', noteId)
    .eq('job_id', jobId)
    .is('deleted_at', null)
    .single();

  if (noteError || !note) return jsonError('Note not found', 404, requestId);

  const { count: imageCount, error: countError } = await supabaseAdmin
    .from('job_note_attachments')
    .select('id', { count: 'exact', head: true })
    .eq('note_id', noteId)
    .eq('media_type', 'image')
    .is('deleted_at', null);

  if (countError) {
    const supabaseErr = normalizeSupabaseError(countError);
    console.error('[job note image upload] count failed:', { requestId, supabaseError: supabaseErr });
    return serverError(requestId, supabaseErr.code ?? 'NOTE_IMAGE_COUNT', 'Failed to prepare image upload');
  }

  if ((imageCount ?? 0) >= JOB_NOTE_IMAGE_MAX_PER_NOTE) {
    return jsonError(`Maximum ${JOB_NOTE_IMAGE_MAX_PER_NOTE} images allowed per note`, 400, requestId);
  }

  const storageFileName = newImageStorageFileName();
  const storagePath = jobNoteImageStoragePath(jobId, validation.job.name, noteId, storageFileName);
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error: uploadError } = await supabaseAdmin.storage.from(BUCKET).upload(storagePath, buffer, {
    contentType: mimeType.startsWith('image/') ? 'image/jpeg' : mimeType,
    upsert: false,
  });

  if (uploadError) {
    const supabaseErr = normalizeSupabaseError(uploadError);
    console.error('[job note image upload] storage failed:', { requestId, supabaseError: supabaseErr });
    return serverError(requestId, supabaseErr.code ?? 'NOTE_IMAGE_UPLOAD', 'Failed to upload image');
  }

  const { data: attachment, error: insertError } = await supabaseAdmin
    .from('job_note_attachments')
    .insert({
      note_id: noteId,
      job_id: jobId,
      storage_path: storagePath,
      media_type: 'image',
      mime_type: mimeType.startsWith('image/') ? 'image/jpeg' : mimeType,
      file_name: file.name || 'photo.jpg',
      file_size_bytes: Math.round(file.size),
      duration_seconds: null,
      uploaded_by: staffAuth.staff.id,
      primary_context_type: note.primary_context_type ?? 'job_note',
      primary_context_id: note.primary_context_id ?? noteId,
    })
    .select('id, note_id, job_id, storage_path, media_type, mime_type, file_name, file_size_bytes, created_at')
    .single();

  if (insertError || !attachment) {
    const supabaseErr = normalizeSupabaseError(insertError ?? null);
    console.error('[job note image upload] insert failed:', { requestId, supabaseError: supabaseErr });
    await supabaseAdmin.storage.from(BUCKET).remove([storagePath]);
    return serverError(requestId, supabaseErr.code ?? 'NOTE_IMAGE_INSERT', 'Failed to save image');
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
    console.error('[job note image upload] context link failed:', { requestId, linkError });
  }

  const res = NextResponse.json({ ok: true, attachment }, { status: 201 });
  res.headers.set('x-request-id', requestId);
  return res;
}
