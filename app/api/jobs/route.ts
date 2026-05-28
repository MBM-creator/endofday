import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { guardStaffApi } from '@/lib/guard-staff-api';
import { fetchCcProjects } from '@/lib/cc-client';
import type { CcProject } from '@/lib/cc-client';
import { ccClientDisplayName } from '@/lib/cc-client-display';
import { syncCcProjectStagesForJob } from '@/lib/sync-cc-project-stages';
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

function isValidUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
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
    console.error('[api/jobs] GET org lookup failed:', { requestId, orgSlug, supabaseError: supabaseErr });
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
    .select(
      'id, organisation_id, name, site_id, created_at, active_stage_id, cc_project_id, cc_client_id, cc_project_title_snapshot, cc_client_name_snapshot, hidden_from_qa_at'
    )
    .eq('organisation_id', org.id)
    .is('hidden_from_qa_at', null)
    .order('created_at', { ascending: false });

  if (jobsError) {
    const supabaseErr = normalizeSupabaseError(jobsError);
    console.error('[api/jobs] GET list failed:', { requestId, supabaseError: supabaseErr });
    return serverError(requestId, supabaseErr.code ?? 'JOBS_LIST', 'Failed to list jobs');
  }

  const res = NextResponse.json({ ok: true, jobs: jobs ?? [] });
  res.headers.set('x-request-id', requestId);
  return res;
}

export async function POST(request: NextRequest) {
  const requestId = request.headers.get('x-vercel-id') ?? randomUUID().slice(0, 8);

  let body: { orgSlug?: string; name?: string; siteId?: string; ccProjectId?: string };
  try {
    const raw = await request.json();
    body = typeof raw === 'object' && raw !== null ? raw : {};
  } catch {
    console.error('[api/jobs] POST body parse failed:', { requestId });
    return serverError(requestId, 'BODY_PARSE', 'Invalid JSON body');
  }

  const orgSlug = String(body.orgSlug ?? '').trim();
  const name = String(body.name ?? '').trim();
  const siteIdRaw = body.siteId != null ? String(body.siteId).trim() : '';
  const ccProjectId = body.ccProjectId != null ? String(body.ccProjectId).trim() : '';

  if (!orgSlug) return jsonError('orgSlug is required', 400, requestId);
  if (!name && !ccProjectId) return jsonError('name or ccProjectId is required', 400, requestId);
  if (siteIdRaw && !isValidUuid(siteIdRaw)) return jsonError('siteId must be a valid UUID', 400, requestId);
  if (ccProjectId && !isValidUuid(ccProjectId)) return jsonError('ccProjectId must be a valid UUID', 400, requestId);

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
    console.error('[api/jobs] POST org lookup failed:', { requestId, orgSlug, supabaseError: supabaseErr });
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

  let siteId: string | null = null;
  if (siteIdRaw) {
    const { data: site, error: siteError } = await supabaseAdmin
      .from('sites')
      .select('id')
      .eq('id', siteIdRaw)
      .eq('organisation_id', org.id)
      .single();
    if (siteError || !site) {
      return jsonError('siteId must belong to the same organisation', 400, requestId);
    }
    siteId = site.id;
  }

  let ccProject: CcProject | null = null;
  if (ccProjectId) {
    let projects;
    try {
      projects = await fetchCcProjects(requestId);
    } catch (err) {
      const message = err instanceof Error && err.message ? err.message : 'Failed to load Client Connect projects';
      console.error('[api/jobs] POST CC fetch failed:', { requestId, error: message });
      const res = NextResponse.json({ ok: false, requestId, message }, { status: 502 });
      res.headers.set('x-request-id', requestId);
      return res;
    }
    ccProject = projects.find((project) => project.project_id === ccProjectId) ?? null;
    if (!ccProject) {
      return jsonError('Selected project is not in the active Client Connect projects list', 400, requestId);
    }

    const { data: existingJob, error: existingError } = await supabaseAdmin
      .from('jobs')
      .select('id, organisation_id, name, site_id, created_at, active_stage_id, cc_project_id, cc_client_id, cc_project_title_snapshot, cc_client_name_snapshot')
      .eq('organisation_id', org.id)
      .eq('cc_project_id', ccProject.project_id)
      .maybeSingle();

    if (existingError) {
      const supabaseErr = normalizeSupabaseError(existingError);
      console.error('[api/jobs] POST existing CC lookup failed:', { requestId, supabaseError: supabaseErr });
      return serverError(requestId, supabaseErr.code ?? 'JOB_CC_LOOKUP', 'Failed to load existing Client Connect job');
    }

    if (existingJob) {
      const res = NextResponse.json({ ok: true, job: existingJob }, { status: 200 });
      res.headers.set('x-request-id', requestId);
      return res;
    }
  }

  const jobName = ccProject?.project_title ?? name;

  const { data: job, error: insertError } = await supabaseAdmin
    .from('jobs')
    .insert({
      organisation_id: org.id,
      name: jobName,
      site_id: siteId,
      cc_project_id: ccProject?.project_id ?? null,
      cc_client_id: ccProject?.client_id ?? null,
      cc_project_title_snapshot: ccProject?.project_title ?? null,
      cc_client_name_snapshot: ccProject ? ccClientDisplayName(ccProject) : null,
    })
    .select('id, organisation_id, name, site_id, created_at, active_stage_id, cc_project_id, cc_client_id, cc_project_title_snapshot, cc_client_name_snapshot')
    .single();

  if (insertError || !job) {
    const supabaseErr = normalizeSupabaseError(insertError ?? null);
    console.error('[api/jobs] POST insert failed:', { requestId, supabaseError: supabaseErr });
    return serverError(requestId, supabaseErr.code ?? 'JOB_INSERT', 'Failed to create job');
  }

  if (ccProject) {
    try {
      await syncCcProjectStagesForJob(job.id as string, ccProject, requestId);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to sync Client Connect sections to stages';
      console.error('[api/jobs] POST CC stage sync failed:', {
        requestId,
        projectId: ccProject.project_id,
        jobId: job.id,
        error: message,
      });
      const res = NextResponse.json({ ok: false, requestId, message }, { status: 502 });
      res.headers.set('x-request-id', requestId);
      return res;
    }
  }

  const res = NextResponse.json({ ok: true, job }, { status: 201 });
  res.headers.set('x-request-id', requestId);
  return res;
}
