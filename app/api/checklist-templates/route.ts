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
    console.error('[api/checklist-templates] GET org lookup failed:', { requestId, orgSlug, supabaseError: supabaseErr });
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

  const { data: templates, error: templatesError } = await supabaseAdmin
    .from('checklist_templates')
    .select('id, organisation_id, name, created_at, updated_at')
    .eq('organisation_id', org.id)
    .order('updated_at', { ascending: false });

  if (templatesError) {
    const supabaseErr = normalizeSupabaseError(templatesError);
    console.error('[api/checklist-templates] GET list failed:', { requestId, supabaseError: supabaseErr });
    return serverError(requestId, supabaseErr.code ?? 'TEMPLATES_LIST', 'Failed to list templates');
  }

  const res = NextResponse.json({ ok: true, templates: templates ?? [] });
  res.headers.set('x-request-id', requestId);
  return res;
}

export async function POST(request: NextRequest) {
  const requestId = request.headers.get('x-vercel-id') ?? randomUUID().slice(0, 8);

  let body: { orgSlug?: string; name?: string };
  try {
    const raw = await request.json();
    body = typeof raw === 'object' && raw !== null ? raw : {};
  } catch {
    console.error('[api/checklist-templates] POST body parse failed:', { requestId });
    return serverError(requestId, 'BODY_PARSE', 'Invalid JSON body');
  }

  const orgSlug = String(body.orgSlug ?? '').trim();
  const name = String(body.name ?? '').trim();

  if (!orgSlug) return jsonError('orgSlug is required', 400, requestId);
  if (!name) return jsonError('name is required', 400, requestId);

  const { data: org, error: orgError } = await supabaseAdmin
    .from('organisations')
    .select('id')
    .eq('slug', orgSlug)
    .single();

  if (orgError || !org) {
    const supabaseErr = normalizeSupabaseError(orgError ?? null);
    console.error('[api/checklist-templates] POST org lookup failed:', { requestId, orgSlug, supabaseError: supabaseErr });
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

  const { data: template, error: insertError } = await supabaseAdmin
    .from('checklist_templates')
    .insert({
      organisation_id: org.id,
      name,
      updated_at: new Date().toISOString(),
    })
    .select('id, organisation_id, name, created_at, updated_at')
    .single();

  if (insertError || !template) {
    const supabaseErr = normalizeSupabaseError(insertError ?? null);
    console.error('[api/checklist-templates] POST insert failed:', { requestId, supabaseError: supabaseErr });
    return serverError(requestId, supabaseErr.code ?? 'TEMPLATE_INSERT', 'Failed to create template');
  }

  const res = NextResponse.json({ ok: true, template }, { status: 201 });
  res.headers.set('x-request-id', requestId);
  return res;
}
