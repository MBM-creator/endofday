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

export async function POST(request: NextRequest) {
  const userAgent = request.headers.get('user-agent') ?? '';
  const contentType = request.headers.get('content-type') ?? '';
  const requestId = request.headers.get('x-vercel-id') ?? randomUUID().slice(0, 8);
  console.log('[daily-report/draft] Request:', {
    requestId,
    headers: { 'user-agent': userAgent.slice(0, 120), 'content-type': contentType.slice(0, 80) },
  });

  let body: { orgSlug?: string };
  try {
    const raw = await request.json();
    body = typeof raw === 'object' && raw !== null ? raw : {};
  } catch {
    console.error('[daily-report/draft] Body parse failed:', { requestId });
    return serverError(requestId, 'BODY_PARSE', 'Invalid JSON body');
  }

  const orgSlug = String(body.orgSlug ?? '').trim();
  if (!orgSlug) {
    return jsonError('Organisation (orgSlug) is required', 400, requestId);
  }

  const { data: org, error: orgError } = await supabaseAdmin
    .from('organisations')
    .select('id')
    .eq('slug', orgSlug)
    .single();

  if (orgError || !org) {
    const supabaseErr = normalizeSupabaseError(orgError ?? null);
    console.error('[daily-report/draft] Org lookup failed:', { requestId, orgSlug, supabaseError: supabaseErr });
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

  const { data: draft, error: draftError } = await supabaseAdmin
    .from('daily_report_drafts')
    .insert({ organisation_id: org.id })
    .select('id')
    .single();

  if (draftError || !draft) {
    const supabaseErr = normalizeSupabaseError(draftError ?? null);
    console.error('[daily-report/draft] Insert failed:', { requestId, supabaseError: supabaseErr });
    return serverError(
      requestId,
      supabaseErr.code ?? 'DRAFT_INSERT',
      'Failed to create draft'
    );
  }

  console.log('[daily-report/draft] Created:', { requestId, draftId: draft.id });
  const res = NextResponse.json({ draftId: draft.id }, { status: 201 });
  res.headers.set('x-request-id', requestId);
  return res;
}
