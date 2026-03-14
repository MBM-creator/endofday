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

function todayUtcDateString(): string {
  return new Date().toISOString().slice(0, 10);
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
    console.error('[api/stages/[stageId]/blocker] Org lookup failed:', { requestId, orgSlug, supabaseError: supabaseErr });
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
    console.error('[api/stages/[stageId]/blocker] Stage lookup failed:', { requestId, stageId, supabaseError: supabaseErr });
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
    console.error('[api/stages/[stageId]/blocker] Job not in org:', { requestId, stageId, supabaseError: supabaseErr });
    const res = NextResponse.json(
      { ok: false, requestId, message: 'Stage not found' },
      { status: 404 }
    );
    res.headers.set('x-request-id', requestId);
    return res;
  }

  return { ok: true };
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

  let body: { blockerType?: unknown; note?: unknown };
  try {
    const raw = await request.json();
    body = typeof raw === 'object' && raw !== null ? raw : {};
  } catch {
    const res = NextResponse.json({ ok: false, requestId, message: 'Invalid JSON body' }, { status: 400 });
    res.headers.set('x-request-id', requestId);
    return res;
  }

  const blockerTypeRaw = body.blockerType;
  const blockerType =
    blockerTypeRaw === null || blockerTypeRaw === undefined
      ? ''
      : String(blockerTypeRaw).trim();

  const noteRaw = body.note;
  const note =
    noteRaw === null || noteRaw === undefined
      ? null
      : String(noteRaw).trim() || null;

  const reportDate = todayUtcDateString();

  if (!blockerType) {
    const { error: deleteError } = await supabaseAdmin
      .from('stage_blockers')
      .delete()
      .eq('stage_id', stageId)
      .eq('report_date', reportDate);

    if (deleteError) {
      const supabaseErr = normalizeSupabaseError(deleteError);
      console.error('[api/stages/[stageId]/blocker] Delete failed:', { requestId, supabaseError: supabaseErr });
      return serverError(requestId, supabaseErr.code ?? 'BLOCKER_DELETE', 'Failed to clear blocker');
    }

    const res = NextResponse.json({ ok: true, blockerType: null, note: null });
    res.headers.set('x-request-id', requestId);
    return res;
  }

  const { error: upsertError } = await supabaseAdmin
    .from('stage_blockers')
    .upsert(
      {
        stage_id: stageId,
        report_date: reportDate,
        blocker_type: blockerType,
        note,
      },
      { onConflict: 'stage_id,report_date' }
    );

  if (upsertError) {
    const supabaseErr = normalizeSupabaseError(upsertError);
    console.error('[api/stages/[stageId]/blocker] Upsert failed:', { requestId, supabaseError: supabaseErr });
    return serverError(requestId, supabaseErr.code ?? 'BLOCKER_UPSERT', 'Failed to save blocker');
  }

  const res = NextResponse.json({
    ok: true,
    blockerType,
    note,
  });
  res.headers.set('x-request-id', requestId);
  return res;
}
