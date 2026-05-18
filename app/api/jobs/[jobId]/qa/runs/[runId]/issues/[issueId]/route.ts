import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { validateJobForOrg, normalizeSupabaseError, isValidUuid } from '@/lib/job-org-validation';
import { guardStaffApi } from '@/lib/guard-staff-api';
import { randomUUID } from 'crypto';

export const runtime = 'nodejs';

type IssueAction = 'request_evidence' | 'require_rectification' | 'approve_rectification' | 'approve_to_proceed';

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

function nextIssueStatus(action: IssueAction): string {
  switch (action) {
    case 'request_evidence':
      return 'evidence_requested';
    case 'require_rectification':
      return 'rectification_required';
    case 'approve_rectification':
      return 'resolved_approved';
    case 'approve_to_proceed':
      return 'proceed_approved';
    default:
      return 'open';
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string; runId: string; issueId: string }> }
) {
  const requestId = request.headers.get('x-vercel-id') ?? randomUUID().slice(0, 8);
  const { jobId, runId, issueId } = await params;
  const orgSlug = request.nextUrl.searchParams.get('orgSlug')?.trim() ?? '';

  const staffAuth = await guardStaffApi(orgSlug, ['supervisor', 'admin']);
  if (staffAuth instanceof NextResponse) {
    staffAuth.headers.set('x-request-id', requestId);
    return staffAuth;
  }

  if (!isValidUuid(runId) || !isValidUuid(issueId)) {
    return jsonError('Not found', 404, requestId);
  }

  const v = await validateJobForOrg(jobId, orgSlug, requestId);
  if (v instanceof NextResponse) {
    v.headers.set('x-request-id', requestId);
    return v;
  }

  const { data: run, error: runErr } = await supabaseAdmin
    .from('paving_qa_runs')
    .select('id, job_id, status')
    .eq('id', runId)
    .eq('job_id', jobId)
    .maybeSingle();

  if (runErr || !run || run.status !== 'active') {
    return jsonError('Run not found or not active', 404, requestId);
  }

  const { data: issue, error: issErr } = await supabaseAdmin
    .from('paving_qa_issues')
    .select('id, run_id, section_code, item_key, status')
    .eq('id', issueId)
    .eq('run_id', runId)
    .maybeSingle();

  if (issErr || !issue) {
    return jsonError('Issue not found', 404, requestId);
  }

  let body: { action?: string; reason?: string };
  try {
    const raw = await request.json();
    body = typeof raw === 'object' && raw !== null ? (raw as typeof body) : {};
  } catch {
    return jsonError('Invalid JSON body', 400, requestId);
  }

  const action = body.action as IssueAction | undefined;
  const valid: IssueAction[] = [
    'request_evidence',
    'require_rectification',
    'approve_rectification',
    'approve_to_proceed',
  ];
  if (!action || !valid.includes(action)) {
    return jsonError('Invalid action', 400, requestId);
  }

  if (action === 'approve_to_proceed') {
    const reason = String(body.reason ?? '').trim();
    if (!reason) {
      return jsonError('reason is required for approve_to_proceed', 400, requestId);
    }
  }

  const newStatus = nextIssueStatus(action);
  const now = new Date().toISOString();

  const { error: updErr } = await supabaseAdmin
    .from('paving_qa_issues')
    .update({ status: newStatus, updated_at: now })
    .eq('id', issueId);

  if (updErr) {
    console.error('[qa/issues PATCH]', { requestId, error: normalizeSupabaseError(updErr) });
    return serverError(requestId);
  }

  const { error: evErr } = await supabaseAdmin.from('paving_qa_supervisor_events').insert({
    run_id: runId,
    issue_id: issueId,
    action,
    reason: body.reason != null ? String(body.reason).trim() || null : null,
    actor_staff_profile_id: staffAuth.staff.id,
    actor_display: staffAuth.staff.full_name,
    actor_role: staffAuth.staff.role,
    created_at: now,
  });

  if (evErr) {
    console.error('[qa/issues PATCH] event', { requestId, error: normalizeSupabaseError(evErr) });
    return serverError(requestId);
  }

  if (action === 'request_evidence') {
    await supabaseAdmin
      .from('paving_qa_section_submissions')
      .update({ submission_status: 'returned', updated_at: now })
      .eq('run_id', runId)
      .eq('section_code', issue.section_code as string);
  }

  await supabaseAdmin.from('paving_qa_runs').update({ updated_at: now }).eq('id', runId);

  const res = NextResponse.json({ ok: true, issue: { id: issueId, status: newStatus } });
  res.headers.set('x-request-id', requestId);
  return res;
}
