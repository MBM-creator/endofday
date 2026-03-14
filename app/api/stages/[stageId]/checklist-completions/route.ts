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

async function validateStageForOrg(
  stageId: string,
  orgSlug: string,
  requestId: string
): Promise<{ ok: true } | NextResponse> {
  if (!stageId || !isValidUuid(stageId)) {
    return jsonError('Stage not found', 404, requestId) as NextResponse;
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
    console.error('[api/stages/[stageId]/checklist-completions] Org lookup failed:', { requestId, orgSlug, supabaseError: supabaseErr });
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

  const { data: stage, error: stageError } = await supabaseAdmin
    .from('stages')
    .select('id, job_id')
    .eq('id', stageId)
    .single();

  if (stageError || !stage) {
    const supabaseErr = normalizeSupabaseError(stageError ?? null);
    console.error('[api/stages/[stageId]/checklist-completions] Stage lookup failed:', { requestId, stageId, supabaseError: supabaseErr });
    const res = NextResponse.json(
      { ok: false, requestId, message: 'Stage not found' },
      { status: 404 }
    );
    res.headers.set('x-request-id', requestId);
    return res;
  }

  const { data: job, error: jobError } = await supabaseAdmin
    .from('jobs')
    .select('id')
    .eq('id', stage.job_id)
    .eq('organisation_id', org.id)
    .single();

  if (jobError || !job) {
    const supabaseErr = normalizeSupabaseError(jobError ?? null);
    console.error('[api/stages/[stageId]/checklist-completions] Job not in org:', { requestId, stageId, supabaseError: supabaseErr });
    const res = NextResponse.json(
      { ok: false, requestId, message: 'Stage not found' },
      { status: 404 }
    );
    res.headers.set('x-request-id', requestId);
    return res;
  }

  return { ok: true };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ stageId: string }> }
) {
  const requestId = request.headers.get('x-vercel-id') ?? randomUUID().slice(0, 8);
  const { stageId } = await params;
  const orgSlug = request.nextUrl.searchParams.get('orgSlug')?.trim() ?? '';

  const validation = await validateStageForOrg(stageId, orgSlug, requestId);
  if (validation instanceof NextResponse) return validation;

  const { data: rows, error } = await supabaseAdmin
    .from('stage_checklist_completions')
    .select('checklist_template_item_id, completed_at')
    .eq('stage_id', stageId);

  if (error) {
    const supabaseErr = normalizeSupabaseError(error);
    console.error('[api/stages/[stageId]/checklist-completions] GET failed:', { requestId, stageId, supabaseError: supabaseErr });
    return serverError(requestId, supabaseErr.code ?? 'COMPLETIONS_GET', 'Failed to load completions');
  }

  const completions: Record<string, string> = {};
  for (const row of rows ?? []) {
    const id = row.checklist_template_item_id;
    const at = row.completed_at;
    if (typeof id === 'string' && typeof at === 'string') {
      completions[id] = at;
    }
  }

  const res = NextResponse.json({ ok: true, completions });
  res.headers.set('x-request-id', requestId);
  return res;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ stageId: string }> }
) {
  const requestId = request.headers.get('x-vercel-id') ?? randomUUID().slice(0, 8);
  const { stageId } = await params;
  const orgSlug = request.nextUrl.searchParams.get('orgSlug')?.trim() ?? '';

  const validation = await validateStageForOrg(stageId, orgSlug, requestId);
  if (validation instanceof NextResponse) return validation;

  let body: { checklistTemplateItemId?: string; completed?: boolean };
  try {
    const raw = await request.json();
    body = typeof raw === 'object' && raw !== null ? raw : {};
  } catch {
    const res = NextResponse.json({ ok: false, requestId, message: 'Invalid JSON body' }, { status: 400 });
    res.headers.set('x-request-id', requestId);
    return res;
  }

  const checklistTemplateItemId = typeof body.checklistTemplateItemId === 'string' ? body.checklistTemplateItemId.trim() : '';
  if (!checklistTemplateItemId || !isValidUuid(checklistTemplateItemId)) {
    return jsonError('checklistTemplateItemId must be a valid UUID', 400, requestId);
  }

  const completed = body.completed === true;

  const { data: stage, error: stageError } = await supabaseAdmin
    .from('stages')
    .select('id, checklist_template_id')
    .eq('id', stageId)
    .single();

  if (stageError || !stage) {
    const supabaseErr = normalizeSupabaseError(stageError ?? null);
    console.error('[api/stages/[stageId]/checklist-completions] Stage fetch failed:', { requestId, stageId, supabaseError: supabaseErr });
    return serverError(requestId, supabaseErr.code ?? 'STAGE_GET', 'Failed to load stage');
  }

  const templateId = stage.checklist_template_id;
  if (!templateId) {
    return jsonError('Stage has no checklist template attached', 400, requestId);
  }

  const { data: item, error: itemError } = await supabaseAdmin
    .from('checklist_template_items')
    .select('id')
    .eq('id', checklistTemplateItemId)
    .eq('template_id', templateId)
    .single();

  if (itemError || !item) {
    const supabaseErr = normalizeSupabaseError(itemError ?? null);
    console.error('[api/stages/[stageId]/checklist-completions] Item not in stage template:', { requestId, checklistTemplateItemId, supabaseError: supabaseErr });
    const res = NextResponse.json(
      { ok: false, requestId, message: 'Checklist item not found or does not belong to this stage' },
      { status: 404 }
    );
    res.headers.set('x-request-id', requestId);
    return res;
  }

  if (completed) {
    const { error: upsertError } = await supabaseAdmin
      .from('stage_checklist_completions')
      .upsert(
        { stage_id: stageId, checklist_template_item_id: checklistTemplateItemId, completed_at: new Date().toISOString() },
        { onConflict: 'stage_id,checklist_template_item_id' }
      );

    if (upsertError) {
      const supabaseErr = normalizeSupabaseError(upsertError);
      console.error('[api/stages/[stageId]/checklist-completions] Upsert failed:', { requestId, supabaseError: supabaseErr });
      return serverError(requestId, supabaseErr.code ?? 'COMPLETION_UPSERT', 'Failed to save completion');
    }
  } else {
    const { error: deleteError } = await supabaseAdmin
      .from('stage_checklist_completions')
      .delete()
      .eq('stage_id', stageId)
      .eq('checklist_template_item_id', checklistTemplateItemId);

    if (deleteError) {
      const supabaseErr = normalizeSupabaseError(deleteError);
      console.error('[api/stages/[stageId]/checklist-completions] Delete failed:', { requestId, supabaseError: supabaseErr });
      return serverError(requestId, supabaseErr.code ?? 'COMPLETION_DELETE', 'Failed to clear completion');
    }
  }

  const res = NextResponse.json({ ok: true });
  res.headers.set('x-request-id', requestId);
  return res;
}
