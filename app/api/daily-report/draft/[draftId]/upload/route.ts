import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { randomUUID } from 'crypto';

export const runtime = 'nodejs';

const BUCKET = 'daily-reports';
const MAX_PHOTOS = 10;

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

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ draftId: string }> }
) {
  const userAgent = request.headers.get('user-agent') ?? '';
  const contentType = request.headers.get('content-type') ?? '';
  const requestId = request.headers.get('x-vercel-id') ?? randomUUID().slice(0, 8);
  const { draftId } = await params;

  console.log('[daily-report/draft/upload] Request:', {
    requestId,
    draftId,
    headers: { 'user-agent': userAgent.slice(0, 120), 'content-type': contentType.slice(0, 80) },
  });

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch (parseError) {
    console.error('[daily-report/draft/upload] Body parse failed:', { requestId, error: parseError });
    return serverError(requestId, 'BODY_PARSE', 'Failed to parse request body');
  }

  const file = formData.get('file') ?? formData.get('photo');
  if (!file || !(file instanceof File) || file.size === 0) {
    return jsonError('One file (field "file" or "photo") is required', 400, requestId);
  }

  const { data: draft, error: draftError } = await supabaseAdmin
    .from('daily_report_drafts')
    .select('id')
    .eq('id', draftId)
    .single();

  if (draftError || !draft) {
    console.error('[daily-report/draft/upload] Draft not found:', { requestId, draftId });
    const res = NextResponse.json({ ok: false, requestId, message: 'Draft not found' }, { status: 404 });
    res.headers.set('x-request-id', requestId);
    return res;
  }

  const { data: existing } = await supabaseAdmin.storage
    .from(BUCKET)
    .list('drafts/' + draftId, { limit: MAX_PHOTOS + 1 });

  const fileCount = Array.isArray(existing) ? existing.length : 0;
  if (fileCount >= MAX_PHOTOS) {
    return jsonError(`Maximum ${MAX_PHOTOS} photos allowed`, 400, requestId);
  }

  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
  const filename = `${randomUUID()}.${ext}`;
  const storagePath = `drafts/${draftId}/${filename}`;

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const { error: uploadError } = await supabaseAdmin.storage
    .from(BUCKET)
    .upload(storagePath, buffer, {
      contentType: file.type || 'image/jpeg',
      upsert: false,
    });

  if (uploadError) {
    const supabaseErr = normalizeSupabaseError(uploadError);
    console.error('[daily-report/draft/upload] Upload failed:', {
      requestId,
      draftId,
      supabaseError: supabaseErr,
    });
    return serverError(
      requestId,
      supabaseErr.code ?? 'PHOTO_UPLOAD',
      'Failed to upload photo'
    );
  }

  console.log('[daily-report/draft/upload] Uploaded:', { requestId, draftId, path: storagePath });
  const res = NextResponse.json({ path: storagePath }, { status: 200 });
  res.headers.set('x-request-id', requestId);
  return res;
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ draftId: string }> }
) {
  const requestId = request.headers.get('x-vercel-id') ?? randomUUID().slice(0, 8);
  const { draftId } = await params;

  let body: { path?: string };
  try {
    const raw = await request.json();
    body = typeof raw === 'object' && raw !== null ? raw : {};
  } catch {
    const res = NextResponse.json({ ok: false, requestId, message: 'Invalid JSON body' }, { status: 400 });
    res.headers.set('x-request-id', requestId);
    return res;
  }

  const path = String(body.path ?? '').trim();
  const expectedPrefix = 'drafts/' + draftId + '/';
  if (!path || !path.startsWith(expectedPrefix)) {
    const res = NextResponse.json({ ok: false, requestId, message: 'Invalid or missing path' }, { status: 400 });
    res.headers.set('x-request-id', requestId);
    return res;
  }

  const { data: draft } = await supabaseAdmin
    .from('daily_report_drafts')
    .select('id')
    .eq('id', draftId)
    .single();

  if (!draft) {
    const res = NextResponse.json({ ok: false, requestId, message: 'Draft not found' }, { status: 404 });
    res.headers.set('x-request-id', requestId);
    return res;
  }

  const { error: removeError } = await supabaseAdmin.storage.from(BUCKET).remove([path]);
  if (removeError) {
    console.error('[daily-report/draft/upload] DELETE failed:', { requestId, path, removeError });
    return serverError(requestId, 'PHOTO_REMOVE', 'Failed to remove photo');
  }

  const res = NextResponse.json({ ok: true }, { status: 200 });
  res.headers.set('x-request-id', requestId);
  return res;
}
