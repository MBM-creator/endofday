import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { guardStaffApi } from '@/lib/guard-staff-api';
import { randomUUID } from 'crypto';

export const runtime = 'nodejs';

function jsonError(message: string, status = 400, requestId?: string) {
  const res = NextResponse.json({ ok: false, message }, { status });
  if (requestId) res.headers.set('x-request-id', requestId);
  return res;
}

function serverError(
  requestId: string,
  errorCode?: string,
  message = 'Internal server error'
) {
  const body: { ok: false; requestId: string; errorCode?: string; message: string } = {
    ok: false,
    requestId,
    message,
  };
  if (errorCode) body.errorCode = errorCode;
  const res = NextResponse.json(body, { status: 500 });
  res.headers.set('x-request-id', requestId);
  return res;
}

function normalizeSupabaseError(err: unknown): {
  code: string | null;
  message: string;
  details: string | null;
  hint: string | null;
} {
  if (err === null || err === undefined) {
    return { code: null, message: '', details: null, hint: null };
  }
  const o = err as Record<string, unknown>;
  return {
    code: typeof o.code === 'string' ? o.code : null,
    message: typeof o.message === 'string' ? o.message : String(err),
    details: typeof o.details === 'string' ? o.details : null,
    hint: typeof o.hint === 'string' ? o.hint : null,
  };
}

type QaRunStatus = 'active' | 'completed' | 'none';

type JobOverviewEntry = {
  id: string;
  name: string;
  activeStageName: string | null;
  qaRunStatus: QaRunStatus;
  qaRunId: string | null;
  qaRunType: 'paving' | 'irrigation' | 'fencing' | null;
  qaRunApprovedAt: string | null;
};

type QaRunRow = {
  id: string;
  job_id: string;
  status: string;
  qa_type?: string | null;
  setup_version: number | null;
  started_at: string;
  updated_at: string | null;
  completed_at: string | null;
  supervisor_final_approved_at: string | null;
};

function runSortTime(run: QaRunRow): number {
  const raw = run.updated_at ?? run.completed_at ?? run.started_at;
  const time = new Date(raw).getTime();
  return Number.isNaN(time) ? 0 : time;
}

function selectOverviewRun(runs: QaRunRow[]): QaRunRow | null {
  const currentRuns = runs.filter((run) => run.qa_type === 'irrigation' || run.qa_type === 'fencing' || run.setup_version === 2);
  const active = currentRuns
    .filter((run) => run.status === 'active')
    .sort((a, b) => runSortTime(b) - runSortTime(a))[0];
  if (active) return active;

  const approved = currentRuns
    .filter((run) => run.status === 'completed' && run.supervisor_final_approved_at)
    .sort((a, b) => runSortTime(b) - runSortTime(a))[0];
  return approved ?? null;
}

export async function GET(request: NextRequest) {
  const requestId = request.headers.get('x-vercel-id') ?? randomUUID().slice(0, 8);
  const orgSlug = request.nextUrl.searchParams.get('orgSlug')?.trim() ?? '';

  if (!orgSlug) {
    return jsonError('orgSlug is required', 400, requestId);
  }

  const staffAuth = await guardStaffApi(orgSlug);
  if (staffAuth instanceof NextResponse) {
    staffAuth.headers.set('x-request-id', requestId);
    return staffAuth;
  }

  const { data: org, error: orgError } = await supabaseAdmin
    .from('organisations')
    .select('id')
    .eq('slug', orgSlug)
    .single();

  if (orgError || !org) {
    const supabaseErr = normalizeSupabaseError(orgError ?? null);
    console.error('[api/jobs/overview] Org lookup failed:', { requestId, orgSlug, supabaseError: supabaseErr });
    const res = NextResponse.json(
      {
        ok: false,
        requestId,
        message: process.env.NODE_ENV === 'development' && orgError
          ? `Invalid organisation: ${orgError.message}`
          : 'Invalid organisation',
      },
      { status: 404 }
    );
    res.headers.set('x-request-id', requestId);
    return res;
  }

  const { data: jobs, error: jobsError } = await supabaseAdmin
    .from('jobs')
    .select('id, name, active_stage_id')
    .eq('organisation_id', org.id)
    .order('created_at', { ascending: false });

  if (jobsError) {
    const supabaseErr = normalizeSupabaseError(jobsError);
    console.error('[api/jobs/overview] Jobs fetch failed:', { requestId, supabaseError: supabaseErr });
    return serverError(requestId, supabaseErr.code ?? 'JOBS_GET', 'Failed to load jobs');
  }

  const jobsList = jobs ?? [];
  if (jobsList.length === 0) {
    const res = NextResponse.json({ ok: true, jobs: [] });
    res.headers.set('x-request-id', requestId);
    return res;
  }

  const jobIds = jobsList.map((j: { id: string }) => j.id);

  const { data: stages, error: stagesError } = await supabaseAdmin
    .from('stages')
    .select('id, job_id, name')
    .in('job_id', jobIds)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });

  if (stagesError) {
    const supabaseErr = normalizeSupabaseError(stagesError);
    console.error('[api/jobs/overview] Stages fetch failed:', { requestId, supabaseError: supabaseErr });
    return serverError(requestId, supabaseErr.code ?? 'STAGES_GET', 'Failed to load stages');
  }

  const { data: qaRuns, error: qaRunsError } = await supabaseAdmin
    .from('paving_qa_runs')
    .select('id, job_id, status, qa_type, setup_version, started_at, updated_at, completed_at, supervisor_final_approved_at')
    .in('job_id', jobIds)
    .in('status', ['active', 'completed']);

  if (qaRunsError) {
    const supabaseErr = normalizeSupabaseError(qaRunsError);
    console.error('[api/jobs/overview] QA runs fetch failed:', { requestId, supabaseError: supabaseErr });
    return serverError(requestId, supabaseErr.code ?? 'QA_RUNS_GET', 'Failed to load QA status');
  }

  const stagesById = new Map<string, { id: string; job_id: string; name: string }>();
  for (const stage of stages ?? []) {
    if (typeof stage.id === 'string') {
      stagesById.set(stage.id, stage as { id: string; job_id: string; name: string });
    }
  }

  const qaRunsByJob = new Map<string, QaRunRow[]>();
  for (const run of (qaRuns ?? []) as QaRunRow[]) {
    if (!qaRunsByJob.has(run.job_id)) qaRunsByJob.set(run.job_id, []);
    qaRunsByJob.get(run.job_id)!.push(run);
  }

  const overview: JobOverviewEntry[] = jobsList.map((job: { id: string; name: string; active_stage_id?: string | null }) => {
    const selectedRun = selectOverviewRun(qaRunsByJob.get(job.id) ?? []);
    const activeStage = job.active_stage_id ? stagesById.get(job.active_stage_id) ?? null : null;
    return {
      id: job.id,
      name: job.name,
      activeStageName: activeStage?.name ?? null,
      qaRunStatus: selectedRun?.status === 'active'
        ? 'active'
        : selectedRun?.status === 'completed'
          ? 'completed'
          : 'none',
      qaRunId: selectedRun?.id ?? null,
      qaRunType: selectedRun
        ? (selectedRun.qa_type === 'irrigation'
          ? 'irrigation'
          : selectedRun.qa_type === 'fencing'
            ? 'fencing'
            : 'paving')
        : null,
      qaRunApprovedAt: selectedRun?.supervisor_final_approved_at ?? null,
    };
  });

  const res = NextResponse.json({ ok: true, jobs: overview });
  res.headers.set('x-request-id', requestId);
  return res;
}
