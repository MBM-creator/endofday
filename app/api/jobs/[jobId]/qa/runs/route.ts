import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { validateJobForOrg, validateStageBelongsToJob, normalizeSupabaseError } from '@/lib/job-org-validation';
import { guardStaffApi } from '@/lib/guard-staff-api';
import { validateSetup } from '@/lib/paving-qa-v1-catalog';
import { loadCcProjectForJob } from '@/lib/cc-project-context';
import { randomUUID } from 'crypto';

export const runtime = 'nodejs';

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

  const v = await validateJobForOrg(jobId, orgSlug, requestId);
  if (v instanceof NextResponse) {
    v.headers.set('x-request-id', requestId);
    return v;
  }

  const { data: rows, error } = await supabaseAdmin
    .from('paving_qa_runs')
    .select(
      'id, job_id, stage_id, status, setup, started_at, updated_at, completed_at, supervisor_final_approved_at'
    )
    .eq('job_id', jobId)
    .order('started_at', { ascending: false });

  if (error) {
    console.error('[qa/runs GET]', { requestId, error: normalizeSupabaseError(error) });
    return serverError(requestId);
  }

  const ccProject = await loadCcProjectForJob(v.job, requestId);
  const res = NextResponse.json({ ok: true, job: v.job, ccProject, runs: rows ?? [] });
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

  const v = await validateJobForOrg(jobId, orgSlug, requestId);
  if (v instanceof NextResponse) {
    v.headers.set('x-request-id', requestId);
    return v;
  }

  let body: { setup?: unknown; stageId?: string | null };
  try {
    const raw = await request.json();
    body = typeof raw === 'object' && raw !== null ? (raw as typeof body) : {};
  } catch {
    return jsonError('Invalid JSON body', 400, requestId);
  }

  const setupParsed = validateSetup(body.setup ?? {});
  if (!setupParsed.ok) {
    return jsonError(setupParsed.message, 400, requestId);
  }
  const setup = setupParsed.setup;

  const stageOk = await validateStageBelongsToJob(body.stageId, jobId, requestId);
  if (stageOk instanceof NextResponse) {
    stageOk.headers.set('x-request-id', requestId);
    return stageOk;
  }
  const stageId =
    body.stageId != null && String(body.stageId).trim() !== ''
      ? String(body.stageId).trim()
      : null;

  const { data: activeRows, error: activeErr } = await supabaseAdmin
    .from('paving_qa_runs')
    .select('id')
    .eq('job_id', jobId)
    .eq('status', 'active')
    .limit(1);

  if (activeErr) {
    console.error('[qa/runs POST] active check', { requestId, error: normalizeSupabaseError(activeErr) });
    return serverError(requestId);
  }
  if (activeRows && activeRows.length > 0) {
    return jsonError('An active paving QA run already exists for this job', 409, requestId);
  }

  const now = new Date().toISOString();
  const { data: inserted, error: insErr } = await supabaseAdmin
    .from('paving_qa_runs')
    .insert({
      job_id: jobId,
      stage_id: stageId,
      status: 'active',
      setup,
      started_at: now,
      updated_at: now,
      started_by: staffAuth.staff.id,
    })
    .select(
      'id, job_id, stage_id, status, setup, started_at, updated_at, completed_at, supervisor_final_approved_at'
    )
    .single();

  if (insErr || !inserted) {
    console.error('[qa/runs POST] insert', { requestId, error: normalizeSupabaseError(insErr ?? null) });
    return serverError(requestId);
  }

  const res = NextResponse.json({ ok: true, run: inserted }, { status: 201 });
  res.headers.set('x-request-id', requestId);
  return res;
}
