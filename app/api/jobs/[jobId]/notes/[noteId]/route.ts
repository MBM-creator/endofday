import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { guardStaffApi } from '@/lib/guard-staff-api';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { validateJobForOrg, normalizeSupabaseError, isValidUuid } from '@/lib/job-org-validation';

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

function canDelete(role: string, staffId: string, authorId: string | null): boolean {
  return role === 'supervisor' || role === 'admin' || staffId === authorId;
}

export async function DELETE(
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

  const { data: note, error: noteError } = await supabaseAdmin
    .from('job_notes')
    .select('id, job_id, author_staff_profile_id')
    .eq('id', noteId)
    .eq('job_id', jobId)
    .is('deleted_at', null)
    .single();

  if (noteError || !note) return jsonError('Note not found', 404, requestId);
  if (!canDelete(staffAuth.staff.role, staffAuth.staff.id, note.author_staff_profile_id ?? null)) {
    return jsonError('You cannot delete this note', 403, requestId);
  }

  const { data: attachments, error: attachmentsError } = await supabaseAdmin
    .from('job_note_attachments')
    .select('id, storage_path')
    .eq('note_id', noteId)
    .is('deleted_at', null);

  if (attachmentsError) {
    const supabaseErr = normalizeSupabaseError(attachmentsError);
    console.error('[api/jobs/[jobId]/notes/[noteId]] attachment list failed:', { requestId, supabaseError: supabaseErr });
    return serverError(requestId, supabaseErr.code ?? 'NOTE_ATTACHMENT_LIST', 'Failed to delete note');
  }

  const paths = (attachments ?? []).map((a) => a.storage_path as string).filter(Boolean);
  if (paths.length > 0) {
    const { error: removeError } = await supabaseAdmin.storage.from(BUCKET).remove(paths);
    if (removeError) {
      const supabaseErr = normalizeSupabaseError(removeError);
      console.error('[api/jobs/[jobId]/notes/[noteId]] storage remove failed:', { requestId, supabaseError: supabaseErr });
      return serverError(requestId, supabaseErr.code ?? 'NOTE_ATTACHMENT_REMOVE', 'Failed to remove video');
    }
  }

  const deletedAt = new Date().toISOString();
  const { error: attachmentUpdateError } = await supabaseAdmin
    .from('job_note_attachments')
    .update({ deleted_at: deletedAt })
    .eq('note_id', noteId)
    .is('deleted_at', null);

  if (attachmentUpdateError) {
    const supabaseErr = normalizeSupabaseError(attachmentUpdateError);
    return serverError(requestId, supabaseErr.code ?? 'NOTE_ATTACHMENT_DELETE', 'Failed to delete note');
  }

  const { error: noteUpdateError } = await supabaseAdmin
    .from('job_notes')
    .update({ deleted_at: deletedAt })
    .eq('id', noteId);

  if (noteUpdateError) {
    const supabaseErr = normalizeSupabaseError(noteUpdateError);
    return serverError(requestId, supabaseErr.code ?? 'NOTE_DELETE', 'Failed to delete note');
  }

  const res = NextResponse.json({ ok: true });
  res.headers.set('x-request-id', requestId);
  return res;
}
