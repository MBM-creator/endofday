import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
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
    .select('id, organisation_id, name, site_id, created_at, active_stage_id')
    .eq('organisation_id', org.id)
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

  let body: { orgSlug?: string; name?: string; siteId?: string };
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

  if (!orgSlug) return jsonError('orgSlug is required', 400, requestId);
  if (!name) return jsonError('name is required', 400, requestId);
  if (siteIdRaw && !isValidUuid(siteIdRaw)) return jsonError('siteId must be a valid UUID', 400, requestId);

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

  const { data: job, error: insertError } = await supabaseAdmin
    .from('jobs')
    .insert({
      organisation_id: org.id,
      name,
      site_id: siteId,
    })
    .select('id, organisation_id, name, site_id, created_at')
    .single();

  if (insertError || !job) {
    const supabaseErr = normalizeSupabaseError(insertError ?? null);
    console.error('[api/jobs] POST insert failed:', { requestId, supabaseError: supabaseErr });
    return serverError(requestId, supabaseErr.code ?? 'JOB_INSERT', 'Failed to create job');
  }

  const res = NextResponse.json({ ok: true, job }, { status: 201 });
  res.headers.set('x-request-id', requestId);
  return res;
}
