import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { randomUUID } from 'crypto';

export const runtime = 'nodejs';

const VALID_ITEM_TYPES = ['tools', 'materials', 'qc'] as const;

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

async function validateTemplateForOrg(
  templateId: string,
  orgSlug: string,
  requestId: string
): Promise<{ ok: true; orgId: string } | NextResponse> {
  if (!templateId || !isValidUuid(templateId)) {
    return jsonError('Template not found', 404, requestId) as NextResponse;
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
    console.error('[api/checklist-templates/[templateId]] Org lookup failed:', { requestId, orgSlug, supabaseError: supabaseErr });
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

  const { data: template, error: templateError } = await supabaseAdmin
    .from('checklist_templates')
    .select('id, organisation_id')
    .eq('id', templateId)
    .single();

  if (templateError || !template || template.organisation_id !== org.id) {
    const supabaseErr = normalizeSupabaseError(templateError ?? null);
    console.error('[api/checklist-templates/[templateId]] Template lookup failed:', { requestId, templateId, supabaseError: supabaseErr });
    const res = NextResponse.json(
      { ok: false, requestId, message: 'Template not found' },
      { status: 404 }
    );
    res.headers.set('x-request-id', requestId);
    return res;
  }

  return { ok: true, orgId: org.id };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ templateId: string }> }
) {
  const requestId = request.headers.get('x-vercel-id') ?? randomUUID().slice(0, 8);
  const { templateId } = await params;
  const orgSlug = request.nextUrl.searchParams.get('orgSlug')?.trim() ?? '';

  const validation = await validateTemplateForOrg(templateId, orgSlug, requestId);
  if (validation instanceof NextResponse) return validation;

  const { data: template, error: templateError } = await supabaseAdmin
    .from('checklist_templates')
    .select('id, organisation_id, name, created_at, updated_at')
    .eq('id', templateId)
    .single();

  if (templateError || !template) {
    const supabaseErr = normalizeSupabaseError(templateError ?? null);
    console.error('[api/checklist-templates/[templateId]] GET template failed:', { requestId, supabaseError: supabaseErr });
    return serverError(requestId, supabaseErr.code ?? 'TEMPLATE_GET', 'Failed to load template');
  }

  const { data: items, error: itemsError } = await supabaseAdmin
    .from('checklist_template_items')
    .select('id, template_id, item_type, label, sort_order')
    .eq('template_id', templateId)
    .order('sort_order', { ascending: true });

  if (itemsError) {
    const supabaseErr = normalizeSupabaseError(itemsError);
    console.error('[api/checklist-templates/[templateId]] GET items failed:', { requestId, supabaseError: supabaseErr });
    return serverError(requestId, supabaseErr.code ?? 'ITEMS_GET', 'Failed to load items');
  }

  const res = NextResponse.json({ ok: true, template, items: items ?? [] });
  res.headers.set('x-request-id', requestId);
  return res;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ templateId: string }> }
) {
  const requestId = request.headers.get('x-vercel-id') ?? randomUUID().slice(0, 8);
  const { templateId } = await params;
  const orgSlug = request.nextUrl.searchParams.get('orgSlug')?.trim() ?? '';

  const validation = await validateTemplateForOrg(templateId, orgSlug, requestId);
  if (validation instanceof NextResponse) return validation;

  let body: { name?: string; items?: Array<{ type?: string; label?: string }> };
  try {
    const raw = await request.json();
    body = typeof raw === 'object' && raw !== null ? raw : {};
  } catch {
    const res = NextResponse.json({ ok: false, requestId, message: 'Invalid JSON body' }, { status: 400 });
    res.headers.set('x-request-id', requestId);
    return res;
  }

  if (body.name !== undefined) {
    const trimmedName = String(body.name ?? '').trim();
    if (!trimmedName) {
      return jsonError('name must be non-empty', 400, requestId);
    }
    const { error: updateError } = await supabaseAdmin
      .from('checklist_templates')
      .update({ name: trimmedName, updated_at: new Date().toISOString() })
      .eq('id', templateId);

    if (updateError) {
      const supabaseErr = normalizeSupabaseError(updateError);
      console.error('[api/checklist-templates/[templateId]] PATCH name failed:', { requestId, supabaseError: supabaseErr });
      return serverError(requestId, supabaseErr.code ?? 'TEMPLATE_UPDATE', 'Failed to update template');
    }
  }

  if (body.items !== undefined) {
    if (!Array.isArray(body.items)) {
      return jsonError('items must be an array', 400, requestId);
    }
    for (let i = 0; i < body.items.length; i++) {
      const item = body.items[i];
      const type = typeof item?.type === 'string' ? item.type.trim() : '';
      const label = typeof item?.label === 'string' ? item.label.trim() : '';
      if (!VALID_ITEM_TYPES.includes(type as (typeof VALID_ITEM_TYPES)[number])) {
        return jsonError(`items[${i}].type must be one of: tools, materials, qc`, 400, requestId);
      }
      if (!label) {
        return jsonError(`items[${i}].label must be non-empty`, 400, requestId);
      }
    }

    const { error: rpcError } = await supabaseAdmin.rpc('replace_checklist_template_items', {
      p_template_id: templateId,
      p_items: body.items,
    });

    if (rpcError) {
      const supabaseErr = normalizeSupabaseError(rpcError);
      console.error('[api/checklist-templates/[templateId]] PATCH replace items failed:', { requestId, supabaseError: supabaseErr });
      return serverError(requestId, supabaseErr.code ?? 'ITEMS_REPLACE', 'Failed to save items');
    }
  }

  const { data: template, error: templateError } = await supabaseAdmin
    .from('checklist_templates')
    .select('id, organisation_id, name, created_at, updated_at')
    .eq('id', templateId)
    .single();

  if (templateError || !template) {
    const supabaseErr = normalizeSupabaseError(templateError ?? null);
    console.error('[api/checklist-templates/[templateId]] PATCH get template failed:', { requestId, supabaseError: supabaseErr });
    return serverError(requestId, supabaseErr.code ?? 'TEMPLATE_GET', 'Failed to load template');
  }

  const { data: items, error: itemsError } = await supabaseAdmin
    .from('checklist_template_items')
    .select('id, template_id, item_type, label, sort_order')
    .eq('template_id', templateId)
    .order('sort_order', { ascending: true });

  if (itemsError) {
    const supabaseErr = normalizeSupabaseError(itemsError);
    console.error('[api/checklist-templates/[templateId]] PATCH get items failed:', { requestId, supabaseError: supabaseErr });
    return serverError(requestId, supabaseErr.code ?? 'ITEMS_GET', 'Failed to load items');
  }

  const res = NextResponse.json({ ok: true, template, items: items ?? [] });
  res.headers.set('x-request-id', requestId);
  return res;
}
