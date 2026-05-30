import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { guardStaffApi } from '@/lib/guard-staff-api';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { validateJobForOrg, validateStageBelongsToJob, normalizeSupabaseError } from '@/lib/job-org-validation';
import { JOB_NOTE_MAX_BODY_LENGTH } from '@/lib/job-notes';
import { linkJobNoteContext } from '@/lib/context-links';

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

function canDeleteNote(role: string, staffId: string, authorId: string | null): boolean {
  return role === 'supervisor' || role === 'admin' || staffId === authorId;
}

function normalizeReportDate(value: unknown): string {
  const raw = value == null || String(value).trim() === '' ? new Date().toISOString().slice(0, 10) : String(value).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return new Date().toISOString().slice(0, 10);
  return raw;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const requestId = request.headers.get('x-vercel-id') ?? randomUUID().slice(0, 8);
  const { jobId } = await params;
  const orgSlug = request.nextUrl.searchParams.get('orgSlug')?.trim() ?? '';

  const staffAuth = await guardStaffApi(orgSlug);
  if (staffAuth instanceof NextResponse) {
    staffAuth.headers.set('x-request-id', requestId);
    return staffAuth;
  }

  const validation = await validateJobForOrg(jobId, orgSlug, requestId);
  if (validation instanceof NextResponse) return validation;

  const { data: notes, error: notesError } = await supabaseAdmin
    .from('job_notes')
    .select(`
      id,
      job_id,
      stage_id,
      report_date,
      primary_context_type,
      primary_context_id,
      author_staff_profile_id,
      body,
      created_at,
      updated_at,
      staff_profiles(full_name, role),
      stages(name),
      job_note_attachments(
        id,
        note_id,
        job_id,
        storage_path,
        media_type,
        mime_type,
        file_name,
        file_size_bytes,
        duration_seconds,
        created_at,
        deleted_at
      )
    `)
    .eq('job_id', jobId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (notesError) {
    const supabaseErr = normalizeSupabaseError(notesError);
    console.error('[api/jobs/[jobId]/notes] GET failed:', { requestId, supabaseError: supabaseErr });
    return serverError(requestId, supabaseErr.code ?? 'NOTES_LIST', 'Failed to load notes');
  }

  const signedUrlExpiry = 3600;
  const rows = [];
  for (const note of notes ?? []) {
    const attachments = [];
    const rawAttachments = Array.isArray(note.job_note_attachments) ? note.job_note_attachments : [];
    for (const attachment of rawAttachments) {
      if (attachment.deleted_at) continue;
      const { data: signed, error: signError } = await supabaseAdmin.storage
        .from(BUCKET)
        .createSignedUrl(attachment.storage_path, signedUrlExpiry);
      if (signError || !signed?.signedUrl) {
        const supabaseErr = normalizeSupabaseError(signError ?? null);
        console.error('[api/jobs/[jobId]/notes] sign failed:', {
          requestId,
          storage_path: attachment.storage_path,
          supabaseError: supabaseErr,
        });
        return serverError(requestId, supabaseErr.code ?? 'NOTE_ATTACHMENT_SIGN', 'Failed to load video URL');
      }
      attachments.push({
        id: attachment.id,
        note_id: attachment.note_id,
        job_id: attachment.job_id,
        media_type: attachment.media_type,
        mime_type: attachment.mime_type,
        file_name: attachment.file_name,
        file_size_bytes: Number(attachment.file_size_bytes),
        duration_seconds: attachment.duration_seconds == null ? null : Number(attachment.duration_seconds),
        created_at: attachment.created_at,
        url: signed.signedUrl,
        can_delete: canDeleteNote(staffAuth.staff.role, staffAuth.staff.id, note.author_staff_profile_id ?? null),
      });
    }

    const profile = Array.isArray(note.staff_profiles) ? note.staff_profiles[0] : note.staff_profiles;
    const stage = Array.isArray(note.stages) ? note.stages[0] : note.stages;
    rows.push({
      id: note.id,
      job_id: note.job_id,
      stage_id: note.stage_id,
      stage_name: stage?.name ?? null,
      report_date: note.report_date ?? null,
      primary_context_type: note.primary_context_type ?? null,
      primary_context_id: note.primary_context_id ?? null,
      author_staff_profile_id: note.author_staff_profile_id,
      author_name: profile?.full_name ?? 'Unknown staff member',
      body: note.body ?? '',
      created_at: note.created_at,
      updated_at: note.updated_at,
      can_delete: canDeleteNote(staffAuth.staff.role, staffAuth.staff.id, note.author_staff_profile_id ?? null),
      attachments,
    });
  }

  const res = NextResponse.json({ ok: true, notes: rows });
  res.headers.set('x-request-id', requestId);
  return res;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const requestId = request.headers.get('x-vercel-id') ?? randomUUID().slice(0, 8);
  const { jobId } = await params;
  const orgSlug = request.nextUrl.searchParams.get('orgSlug')?.trim() ?? '';

  const staffAuth = await guardStaffApi(orgSlug);
  if (staffAuth instanceof NextResponse) {
    staffAuth.headers.set('x-request-id', requestId);
    return staffAuth;
  }

  const validation = await validateJobForOrg(jobId, orgSlug, requestId);
  if (validation instanceof NextResponse) return validation;

  let body: { body?: unknown; stageId?: unknown; reportDate?: unknown; hasAttachmentIntent?: unknown };
  try {
    const raw = await request.json();
    body = typeof raw === 'object' && raw !== null ? raw : {};
  } catch {
    return jsonError('Invalid JSON body', 400, requestId);
  }

  const noteBody = String(body.body ?? '').trim();
  const stageId = body.stageId == null || String(body.stageId).trim() === '' ? null : String(body.stageId).trim();
  const reportDate = normalizeReportDate(body.reportDate);
  const hasAttachmentIntent = body.hasAttachmentIntent === true;
  if (!noteBody && !hasAttachmentIntent) {
    return jsonError('Add a note or video before posting', 400, requestId);
  }
  if (noteBody.length > JOB_NOTE_MAX_BODY_LENGTH) {
    return jsonError(`Note must be at most ${JOB_NOTE_MAX_BODY_LENGTH} characters`, 400, requestId);
  }

  const stageValidation = await validateStageBelongsToJob(stageId, jobId, requestId);
  if (stageValidation instanceof NextResponse) return stageValidation;

  const { data: note, error: insertError } = await supabaseAdmin
    .from('job_notes')
    .insert({
      job_id: jobId,
      stage_id: stageId,
      report_date: reportDate,
      primary_context_type: stageId ? 'stage' : 'job',
      primary_context_id: stageId || jobId,
      author_staff_profile_id: staffAuth.staff.id,
      body: noteBody || null,
    })
    .select('id, job_id, stage_id, report_date, primary_context_type, primary_context_id, author_staff_profile_id, body, created_at, updated_at')
    .single();

  if (insertError || !note) {
    const supabaseErr = normalizeSupabaseError(insertError ?? null);
    console.error('[api/jobs/[jobId]/notes] POST failed:', { requestId, supabaseError: supabaseErr });
    return serverError(requestId, supabaseErr.code ?? 'NOTE_INSERT', 'Failed to save note');
  }

  try {
    await linkJobNoteContext({
      noteId: note.id,
      organisationId: validation.organisationId,
      jobId,
      stageId,
      reportDate,
      staffProfileId: staffAuth.staff.id,
      ccProjectId: validation.job.cc_project_id,
      ccJobId: null,
    });
  } catch (linkError) {
    console.error('[api/jobs/[jobId]/notes] context link failed:', { requestId, linkError });
  }

  const res = NextResponse.json({ ok: true, note }, { status: 201 });
  res.headers.set('x-request-id', requestId);
  return res;
}
