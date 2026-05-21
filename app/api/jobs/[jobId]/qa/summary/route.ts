import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { validateJobForOrg, normalizeSupabaseError } from '@/lib/job-org-validation';
import { guardStaffApi } from '@/lib/guard-staff-api';
import { loadRunBundle } from '@/lib/paving-qa-run-bundle';
import { activeRunHasIncompleteEvidence } from '@/lib/paving-qa-v1-graph';
import { randomUUID } from 'crypto';

export const runtime = 'nodejs';

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

  const { data: active, error } = await supabaseAdmin
    .from('paving_qa_runs')
    .select('id, status, setup, started_at')
    .eq('job_id', jobId)
    .eq('status', 'active')
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('[qa/summary]', { requestId, error: normalizeSupabaseError(error) });
    return serverError(requestId);
  }

  if (!active) {
    const res = NextResponse.json({
      ok: true,
      activeRun: null,
      incompleteEvidence: false,
    });
    res.headers.set('x-request-id', requestId);
    return res;
  }

  const bundle = await loadRunBundle(active.id as string, jobId);
  if (!bundle.ok) {
    const res = NextResponse.json({
      ok: true,
      activeRun: { id: active.id, started_at: active.started_at },
      incompleteEvidence: true,
    });
    res.headers.set('x-request-id', requestId);
    return res;
  }

  const incomplete = activeRunHasIncompleteEvidence(
    bundle.setup,
    bundle.submissions,
    bundle.photoRows,
    bundle.issues
  );

  const res = NextResponse.json({
    ok: true,
    activeRun: {
      id: active.id,
      started_at: active.started_at,
      setup: bundle.setup,
    },
    incompleteEvidence: incomplete,
  });
  res.headers.set('x-request-id', requestId);
  return res;
}
