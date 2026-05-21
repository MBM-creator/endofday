import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { validateJobForOrg, normalizeSupabaseError, isValidUuid } from '@/lib/job-org-validation';
import { guardStaffApi } from '@/lib/guard-staff-api';
import { applicableSectionCodes, getSectionItemsForSetup, parseRunSetup } from '@/lib/paving-qa-v1-catalog';
import {
  buildPhotoCounts,
  buildSubmissionMap,
  canSubmitSection,
  isPavingSectionCode,
  type IssueSnapshot,
  type SubmissionSnapshot,
} from '@/lib/paving-qa-v1-graph';
import { validateCrewSectionPayload } from '@/lib/paving-qa-submit-validation';
import { newImageStorageFileName, pavingQaPhotoStoragePath } from '@/lib/storage-paths';
import type { PavingSectionCode } from '@/lib/paving-qa-v1-types';
import { randomUUID } from 'crypto';

export const runtime = 'nodejs';

const BUCKET = 'daily-reports';
const MAX_PHOTOS_PER_SECTION = 40;
const MAX_FILE_BYTES = 8 * 1024 * 1024;
const ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
]);

function jsonError(message: string, status = 400, requestId?: string) {
  const res = NextResponse.json({ ok: false, message }, { status });
  if (requestId) res.headers.set('x-request-id', requestId);
  return res;
}

function conflictError(message: string, blockers: unknown, requestId: string) {
  const res = NextResponse.json({ ok: false, message, blockers }, { status: 409 });
  res.headers.set('x-request-id', requestId);
  return res;
}

function serverError(requestId: string, message = 'Internal server error') {
  const res = NextResponse.json({ ok: false, requestId, message }, { status: 500 });
  res.headers.set('x-request-id', requestId);
  return res;
}

async function loadSubmissionsAndIssues(runId: string): Promise<{
  submissions: SubmissionSnapshot[];
  issues: IssueSnapshot[];
  photoRows: { section_code: string; item_key: string }[];
}> {
  const { data: subRows } = await supabaseAdmin
    .from('paving_qa_section_submissions')
    .select('section_code, submission_status, answers, submitted_at')
    .eq('run_id', runId);

  const submissions: SubmissionSnapshot[] = (subRows ?? []).map((r) => ({
    section_code: r.section_code as string,
    submission_status: r.submission_status as string,
    answers: (r.answers as Record<string, { result?: string; note?: string }>) ?? {},
    submitted_at: r.submitted_at as string | null | undefined,
  }));

  const { data: issueRows } = await supabaseAdmin
    .from('paving_qa_issues')
    .select('id, section_code, item_key, severity, status, title')
    .eq('run_id', runId);

  const issues: IssueSnapshot[] = (issueRows ?? []).map((r) => ({
    id: r.id as string,
    section_code: r.section_code as string,
    item_key: r.item_key as string,
    severity: r.severity as string,
    status: r.status as string,
    title: (r.title as string) ?? null,
  }));

  const { data: photoRows } = await supabaseAdmin
    .from('paving_qa_photos')
    .select('section_code, item_key')
    .eq('run_id', runId);

  return {
    submissions,
    issues,
    photoRows: (photoRows ?? []) as { section_code: string; item_key: string }[],
  };
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string; runId: string; sectionCode: string }> }
) {
  const requestId = request.headers.get('x-vercel-id') ?? randomUUID().slice(0, 8);
  const { jobId, runId, sectionCode: sectionCodeRaw } = await params;
  const orgSlug = request.nextUrl.searchParams.get('orgSlug')?.trim() ?? '';
  const sectionCode = sectionCodeRaw as PavingSectionCode;

  const staffAuth = await guardStaffApi(orgSlug, ['field', 'supervisor', 'admin']);
  if (staffAuth instanceof NextResponse) {
    staffAuth.headers.set('x-request-id', requestId);
    return staffAuth;
  }

  if (!isValidUuid(runId)) {
    return jsonError('Run not found', 404, requestId);
  }

  const v = await validateJobForOrg(jobId, orgSlug, requestId);
  if (v instanceof NextResponse) {
    v.headers.set('x-request-id', requestId);
    return v;
  }

  if (!isPavingSectionCode(sectionCodeRaw)) {
    return jsonError('Unknown section', 400, requestId);
  }

  const { data: run, error: runErr } = await supabaseAdmin
    .from('paving_qa_runs')
    .select('id, job_id, status, setup')
    .eq('id', runId)
    .eq('job_id', jobId)
    .maybeSingle();

  if (runErr || !run) {
    return jsonError('Run not found', 404, requestId);
  }
  if (run.status !== 'active') {
    return jsonError('This run is not active', 409, requestId);
  }

  const setup = parseRunSetup(run.setup);
  if (!setup) {
    return serverError(requestId, 'Invalid run setup');
  }

  if (!applicableSectionCodes(setup).includes(sectionCode)) {
    return jsonError('Section is not part of this run', 400, requestId);
  }

  const { submissions, issues, photoRows } = await loadSubmissionsAndIssues(runId);
  const bySection = buildSubmissionMap(submissions);
  const photoCountsAll = buildPhotoCounts(photoRows);
  const can = canSubmitSection(sectionCode, setup, bySection, photoCountsAll, issues);
  if (!can.ok) {
    return conflictError(can.message, { code: can.code, blockedBy: can.blockedBy }, requestId);
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return jsonError('Failed to parse request body', 400, requestId);
  }

  const answersRaw = String(formData.get('answers') ?? '').trim();
  let answers: Record<string, { result?: string; note?: string }> = {};
  if (answersRaw) {
    try {
      const parsed = JSON.parse(answersRaw) as unknown;
      if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) {
        answers = parsed as Record<string, { result?: string; note?: string }>;
      }
    } catch {
      return jsonError('answers must be valid JSON', 400, requestId);
    }
  }

  const filesByItem = new Map<string, File[]>();
  for (const [key, val] of formData.entries()) {
    if (key.startsWith('item_') && val instanceof File && val.size > 0) {
      const itemKey = key.slice('item_'.length);
      if (!itemKey) continue;
      const list = filesByItem.get(itemKey) ?? [];
      list.push(val);
      filesByItem.set(itemKey, list);
    }
  }

  let totalNewFiles = 0;
  const photoCountByItem: Record<string, number> = {};
  const items = getSectionItemsForSetup(sectionCode, setup);
  for (const item of items) {
    const existing = [...photoRows].filter((p) => p.section_code === sectionCode && p.item_key === item.key).length;
    const incoming = filesByItem.get(item.key)?.length ?? 0;
    photoCountByItem[item.key] = existing + incoming;
    totalNewFiles += incoming;
  }

  if (totalNewFiles > MAX_PHOTOS_PER_SECTION) {
    return jsonError(`At most ${MAX_PHOTOS_PER_SECTION} new photos per submit`, 400, requestId);
  }

  for (const [, files] of filesByItem) {
    for (const file of files) {
      if (file.size > MAX_FILE_BYTES) {
        return jsonError('Each photo must be at most 8MB', 400, requestId);
      }
      const mt = (file.type || 'image/jpeg').toLowerCase();
      if (!ALLOWED_MIME.has(mt)) {
        return jsonError(`Unsupported image type: ${mt}`, 400, requestId);
      }
    }
  }

  const payloadCheck = validateCrewSectionPayload(setup, sectionCode, answers, photoCountByItem);
  if (!payloadCheck.ok) {
    return NextResponse.json({ ok: false, message: 'Validation failed', errors: payloadCheck.errors }, { status: 400 });
  }

  const { data: existingPhotoRows } = await supabaseAdmin
    .from('paving_qa_photos')
    .select('id, storage_path')
    .eq('run_id', runId)
    .eq('section_code', sectionCode);

  const pathsToRemove = (existingPhotoRows ?? []).map((r) => r.storage_path as string);
  if (pathsToRemove.length > 0) {
    const { error: rmErr } = await supabaseAdmin.storage.from(BUCKET).remove(pathsToRemove);
    if (rmErr) {
      console.warn('[qa/submit] storage remove', { requestId, rmErr });
    }
    await supabaseAdmin.from('paving_qa_photos').delete().eq('run_id', runId).eq('section_code', sectionCode);
  }

  const jobName = v.job.name;
  const submittedAt = new Date().toISOString();
  const actorDisplay = staffAuth.staff.full_name;

  for (const [itemKey, files] of filesByItem) {
    for (const file of files) {
      const fileName = newImageStorageFileName();
      const storagePath = pavingQaPhotoStoragePath(jobId, jobName, runId, sectionCode, itemKey, fileName);
      const buf = Buffer.from(await file.arrayBuffer());
      const { error: upErr } = await supabaseAdmin.storage.from(BUCKET).upload(storagePath, buf, {
        contentType: file.type || 'image/jpeg',
        upsert: false,
      });
      if (upErr) {
        console.error('[qa/submit] upload', { requestId, storagePath, error: normalizeSupabaseError(upErr) });
        return serverError(requestId, 'Photo upload failed');
      }
      const { error: phErr } = await supabaseAdmin.from('paving_qa_photos').insert({
        run_id: runId,
        section_code: sectionCode,
        item_key: itemKey,
        storage_path: storagePath,
        content_type: file.type || 'image/jpeg',
        uploaded_by: staffAuth.staff.id,
      });
      if (phErr) {
        console.error('[qa/submit] photo row', { requestId, error: normalizeSupabaseError(phErr) });
        return serverError(requestId, 'Failed to save photo record');
      }
    }
  }

  const { error: upsertErr } = await supabaseAdmin.from('paving_qa_section_submissions').upsert(
    {
      run_id: runId,
      section_code: sectionCode,
      submission_status: 'submitted',
      answers,
      submitted_at: submittedAt,
      submitted_by: staffAuth.staff.id,
      updated_at: submittedAt,
    },
    { onConflict: 'run_id,section_code' }
  );

  if (upsertErr) {
    console.error('[qa/submit] submission', { requestId, error: normalizeSupabaseError(upsertErr) });
    return serverError(requestId, 'Failed to save submission');
  }

  for (const item of items) {
    const r = (answers[item.key]?.result ?? '').trim();
    if (r === 'pass' || r === 'na') {
      await supabaseAdmin
        .from('paving_qa_issues')
        .delete()
        .eq('run_id', runId)
        .eq('section_code', sectionCode)
        .eq('item_key', item.key)
        .in('status', ['open', 'evidence_requested']);
    }
  }

  for (const item of items) {
    const r = (answers[item.key]?.result ?? '').trim();
    if (r !== 'fail') continue;

    const { data: existingBlocking } = await supabaseAdmin
      .from('paving_qa_issues')
      .select('id')
      .eq('run_id', runId)
      .eq('section_code', sectionCode)
      .eq('item_key', item.key)
      .in('status', ['open', 'rectification_required', 'evidence_requested'])
      .limit(1)
      .maybeSingle();

    if (existingBlocking) continue;

    if (r === 'fail' && item.criticalOnFail) {
      const { error: issErr } = await supabaseAdmin.from('paving_qa_issues').insert({
        run_id: runId,
        section_code: sectionCode,
        item_key: item.key,
        severity: 'critical',
        status: 'open',
        title: item.label,
        detail: (answers[item.key]?.note ?? '').trim() || null,
      });
      if (issErr) {
        console.error('[qa/submit] issue insert', { requestId, error: normalizeSupabaseError(issErr) });
      }
    }
    if (r === 'fail' && item.requireSupervisorOnFail) {
      const { data: ex2 } = await supabaseAdmin
        .from('paving_qa_issues')
        .select('id')
        .eq('run_id', runId)
        .eq('section_code', sectionCode)
        .eq('item_key', item.key)
        .in('status', ['open', 'rectification_required', 'evidence_requested'])
        .limit(1)
        .maybeSingle();
      if (ex2) continue;
      const { error: issErr } = await supabaseAdmin.from('paving_qa_issues').insert({
        run_id: runId,
        section_code: sectionCode,
        item_key: item.key,
        severity: 'non_critical',
        status: 'open',
        title: item.label,
        detail: (answers[item.key]?.note ?? '').trim() || null,
      });
      if (issErr) {
        console.error('[qa/submit] issue insert nc', { requestId, error: normalizeSupabaseError(issErr) });
      }
    }
  }

  await supabaseAdmin.from('paving_qa_runs').update({ updated_at: submittedAt }).eq('id', runId);

  const res = NextResponse.json({
    ok: true,
    submittedAt,
    actorDisplay,
    sectionCode,
  });
  res.headers.set('x-request-id', requestId);
  return res;
}
