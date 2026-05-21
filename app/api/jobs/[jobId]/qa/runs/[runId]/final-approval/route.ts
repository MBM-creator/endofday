import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { validateJobForOrg, normalizeSupabaseError, isValidUuid } from '@/lib/job-org-validation';
import { guardStaffApi } from '@/lib/guard-staff-api';
import { loadRunBundle } from '@/lib/paving-qa-run-bundle';
import { activeRunHasIncompleteEvidence } from '@/lib/paving-qa-v1-graph';
import { computeV2SectionUiStates } from '@/lib/paving-qa-v2-graph';
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

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string; runId: string }> }
) {
  const requestId = request.headers.get('x-vercel-id') ?? randomUUID().slice(0, 8);
  const { jobId, runId } = await params;
  const orgSlug = request.nextUrl.searchParams.get('orgSlug')?.trim() ?? '';

  const staffAuth = await guardStaffApi(orgSlug, ['supervisor', 'admin']);
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

  let body: { reason?: string };
  try {
    const raw = await request.json();
    body = typeof raw === 'object' && raw !== null ? (raw as typeof body) : {};
  } catch {
    body = {};
  }

  const { data: run, error: runErr } = await supabaseAdmin
    .from('paving_qa_runs')
    .select('id, job_id, status, supervisor_final_approved_at')
    .eq('id', runId)
    .eq('job_id', jobId)
    .maybeSingle();

  if (runErr || !run) {
    return jsonError('Run not found', 404, requestId);
  }
  if (run.status !== 'active') {
    return jsonError('Run is not active', 409, requestId);
  }
  if (run.supervisor_final_approved_at) {
    return jsonError('Run already has final approval', 409, requestId);
  }

  const bundle = await loadRunBundle(runId, jobId);
  if (!bundle.ok) {
    return jsonError('Run not found', 404, requestId);
  }

  if (bundle.version === 2) {
    const sectionStates = computeV2SectionUiStates(
      bundle.setup,
      bundle.submissions,
      bundle.photoRows,
      bundle.issues
    );
    const incompleteSections = sectionStates.filter((s) => !s.cleared);
    if (incompleteSections.length > 0) {
      const res = NextResponse.json(
        {
          ok: false,
          message: 'Paving QA v2 cannot be final-approved until all applicable sections are cleared.',
          incompleteSections: incompleteSections.map((s) => ({
            code: s.code,
            title: s.title,
            status: s.status,
          })),
        },
        { status: 409 }
      );
      res.headers.set('x-request-id', requestId);
      return res;
    }
    // All v2 sections cleared — fall through to the shared approval write path below.
  }

  if (bundle.version !== 2 && activeRunHasIncompleteEvidence(bundle.setup, bundle.submissions, bundle.photoRows, bundle.issues)) {
    return jsonError('Not all sections are cleared; complete QA evidence first', 409, requestId);
  }

  const now = new Date().toISOString();
  const reason = body.reason != null ? String(body.reason).trim() : null;

  const { error: evErr } = await supabaseAdmin.from('paving_qa_supervisor_events').insert({
    run_id: runId,
    issue_id: null,
    action: 'final_approval',
    reason,
    actor_staff_profile_id: staffAuth.staff.id,
    actor_display: staffAuth.staff.full_name,
    actor_role: staffAuth.staff.role,
    created_at: now,
  });

  if (evErr) {
    console.error('[qa/final-approval] event', { requestId, error: normalizeSupabaseError(evErr) });
    return serverError(requestId);
  }

  const { error: updErr } = await supabaseAdmin
    .from('paving_qa_runs')
    .update({
      supervisor_final_approved_at: now,
      supervisor_final_approved_by: staffAuth.staff.id,
      updated_at: now,
      status: 'completed',
      completed_at: now,
    })
    .eq('id', runId);

  if (updErr) {
    console.error('[qa/final-approval] run', { requestId, error: normalizeSupabaseError(updErr) });
    return serverError(requestId);
  }

  const res = NextResponse.json({ ok: true, supervisorFinalApprovedAt: now });
  res.headers.set('x-request-id', requestId);
  return res;
}
