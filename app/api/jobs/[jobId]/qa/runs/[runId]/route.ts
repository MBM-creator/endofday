import { NextRequest, NextResponse } from 'next/server';
import { validateJobForOrg, isValidUuid } from '@/lib/job-org-validation';
import { guardStaffApi } from '@/lib/guard-staff-api';
import { loadRunBundle, computeRunSectionStates } from '@/lib/paving-qa-run-bundle';
import { loadQaRunBundle } from '@/lib/qa-run-bundle';
import { computeV2SectionUiStates } from '@/lib/paving-qa-v2-graph';
import { computeIrrigationSectionUiStates } from '@/lib/irrigation-qa-v1-graph';
import { computeFencingSectionUiStates } from '@/lib/fencing-qa-v1-graph';
import { randomUUID } from 'crypto';

export const runtime = 'nodejs';

function jsonError(message: string, status = 400, requestId?: string) {
  const res = NextResponse.json({ ok: false, message }, { status });
  if (requestId) res.headers.set('x-request-id', requestId);
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

  const typedBundle = await loadQaRunBundle(runId, jobId);
  if (typedBundle.ok && typedBundle.qaType === 'irrigation') {
    const sectionStates = computeIrrigationSectionUiStates(
      typedBundle.setup,
      typedBundle.submissions,
      typedBundle.photoRows,
      typedBundle.issues
    );
    const res = NextResponse.json({
      ok: true,
      job: v.job,
      run: typedBundle.run,
      qaType: 'irrigation',
      setupVersion: 1,
      setup: typedBundle.setup,
      sectionStates,
      issues: typedBundle.issues,
      submissions: typedBundle.submissions,
      photoRows: typedBundle.photoRows,
    });
    res.headers.set('x-request-id', requestId);
    return res;
  }

  if (typedBundle.ok && typedBundle.qaType === 'fencing') {
    const sectionStates = computeFencingSectionUiStates(
      typedBundle.setup,
      typedBundle.submissions,
      typedBundle.photoRows,
      typedBundle.issues
    );
    const res = NextResponse.json({
      ok: true,
      job: v.job,
      run: typedBundle.run,
      qaType: 'fencing',
      setupVersion: 1,
      setup: typedBundle.setup,
      sectionStates,
      issues: typedBundle.issues,
      submissions: typedBundle.submissions,
      photoRows: typedBundle.photoRows,
    });
    res.headers.set('x-request-id', requestId);
    return res;
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
    const res = NextResponse.json({
      ok: true,
      job: v.job,
      run: bundle.run,
      qaType: 'paving',
      setupVersion: 2,
      setup: bundle.setup,
      sectionStates,
      issues: bundle.issues,
      submissions: bundle.submissions,
      // photoRows lets the section page show per-item photo counts without an extra round-trip
      photoRows: bundle.photoRows,
    });
    res.headers.set('x-request-id', requestId);
    return res;
  }

  // v1 path — compute section states using existing graph
  const sectionStates = computeRunSectionStates(
    bundle.setup,
    bundle.submissions,
    bundle.photoRows,
    bundle.issues
  );

  const res = NextResponse.json({
    ok: true,
    job: v.job,
    run: bundle.run,
    qaType: 'paving',
    setupVersion: 1,
    setup: bundle.setup,
    sectionStates,
    issues: bundle.issues,
    submissions: bundle.submissions,
    photoRows: bundle.photoRows,
  });
  res.headers.set('x-request-id', requestId);
  return res;
}
