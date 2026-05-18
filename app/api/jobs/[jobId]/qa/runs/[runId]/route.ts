import { NextRequest, NextResponse } from 'next/server';
import { validateJobForOrg, normalizeSupabaseError, isValidUuid } from '@/lib/job-org-validation';
import { guardStaffApi } from '@/lib/guard-staff-api';
import { loadRunBundle, computeRunSectionStates } from '@/lib/paving-qa-run-bundle';
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
  { params }: { params: Promise<{ jobId: string; runId: string }> }
) {
  const requestId = request.headers.get('x-vercel-id') ?? randomUUID().slice(0, 8);
  const { jobId, runId } = await params;
  const orgSlug = request.nextUrl.searchParams.get('orgSlug')?.trim() ?? '';

  const staffAuth = await guardStaffApi(orgSlug);
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

  const bundle = await loadRunBundle(runId, jobId);
  if (!bundle.ok) {
    return jsonError('Run not found', 404, requestId);
  }

  const sectionStates = computeRunSectionStates(
    bundle.setup,
    bundle.submissions,
    bundle.photoRows,
    bundle.issues
  );

  const res = NextResponse.json({
    ok: true,
    run: bundle.run,
    setup: bundle.setup,
    sectionStates,
    issues: bundle.issues,
    submissions: bundle.submissions,
  });
  res.headers.set('x-request-id', requestId);
  return res;
}
