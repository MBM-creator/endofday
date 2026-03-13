import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { randomUUID } from 'crypto';

export const runtime = 'nodejs';

const MAX_CONTENT_LENGTH = 10000;

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

async function validateJobForOrg(
  jobId: string,
  orgSlug: string,
  requestId: string
): Promise<{ ok: true } | NextResponse> {
  if (!jobId || !isValidUuid(jobId)) {
    return jsonError('Job not found', 404, requestId) as NextResponse;
  }
  if (!orgSlug) {
    return jsonError('orgSlug is required', 400, requestId) as NextResponse;
  }

  const { data: org, error: orgError } = await supabaseAdmin
    .from('organisations')
    .select('id')
    .eq('slug', orgSlug)
    .single();

  if (orgError || !org) {
    const supabaseErr = normalizeSupabaseError(orgError ?? null);
    console.error('[api/jobs/[jobId]/brief] Org lookup failed:', { requestId, orgSlug, supabaseError: supabaseErr });
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

  const { data: job, error: jobError } = await supabaseAdmin
    .from('jobs')
    .select('id')
    .eq('id', jobId)
    .eq('organisation_id', org.id)
    .single();

  if (jobError || !job) {
    const supabaseErr = normalizeSupabaseError(jobError ?? null);
    console.error('[api/jobs/[jobId]/brief] Job lookup failed:', { requestId, jobId, supabaseError: supabaseErr });
    const res = NextResponse.json(
      {
        ok: false,
        requestId,
        message: process.env.NODE_ENV === 'development' && jobError
          ? `Job not found: ${jobError.message}`
          : 'Job not found',
      },
      { status: 404 }
    );
    res.headers.set('x-request-id', requestId);
    return res;
  }

  return { ok: true };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const requestId = request.headers.get('x-vercel-id') ?? randomUUID().slice(0, 8);
  const { jobId } = await params;
  const orgSlug = request.nextUrl.searchParams.get('orgSlug')?.trim() ?? '';

  const validation = await validateJobForOrg(jobId, orgSlug, requestId);
  if (validation instanceof NextResponse) return validation;

  const { data: brief, error: briefError } = await supabaseAdmin
    .from('job_briefs')
    .select('id, job_id, content, updated_at')
    .eq('job_id', jobId)
    .maybeSingle();

  if (briefError) {
    const supabaseErr = normalizeSupabaseError(briefError);
    console.error('[api/jobs/[jobId]/brief] GET failed:', { requestId, supabaseError: supabaseErr });
    return serverError(requestId, supabaseErr.code ?? 'BRIEF_GET', 'Failed to load job brief');
  }

  const res = NextResponse.json({ ok: true, brief: brief ?? null });
  res.headers.set('x-request-id', requestId);
  return res;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const requestId = request.headers.get('x-vercel-id') ?? randomUUID().slice(0, 8);
  const { jobId } = await params;
  const orgSlug = request.nextUrl.searchParams.get('orgSlug')?.trim() ?? '';

  const validation = await validateJobForOrg(jobId, orgSlug, requestId);
  if (validation instanceof NextResponse) return validation;

  let body: { content?: string | null };
  try {
    const raw = await request.json();
    body = typeof raw === 'object' && raw !== null ? raw : {};
  } catch {
    const res = NextResponse.json({ ok: false, requestId, message: 'Invalid JSON body' }, { status: 400 });
    res.headers.set('x-request-id', requestId);
    return res;
  }

  if (body.content === undefined) {
    return jsonError('content is required', 400, requestId);
  }
  const rawContent = body.content === null ? null : String(body.content);
  const toStore = rawContent === null || rawContent === '' ? null : rawContent.slice(0, MAX_CONTENT_LENGTH);
  if (toStore !== null && rawContent !== null && rawContent.length > MAX_CONTENT_LENGTH) {
    return jsonError(`Content must be at most ${MAX_CONTENT_LENGTH} characters`, 400, requestId);
  }

  const { data: brief, error: upsertError } = await supabaseAdmin
    .from('job_briefs')
    .upsert(
      {
        job_id: jobId,
        content: toStore,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'job_id' }
    )
    .select('id, job_id, content, updated_at')
    .single();

  if (upsertError || !brief) {
    const supabaseErr = normalizeSupabaseError(upsertError ?? null);
    console.error('[api/jobs/[jobId]/brief] PATCH failed:', { requestId, supabaseError: supabaseErr });
    return serverError(requestId, supabaseErr.code ?? 'BRIEF_SAVE', 'Failed to save job brief');
  }

  const res = NextResponse.json({ ok: true, brief });
  res.headers.set('x-request-id', requestId);
  return res;
}
