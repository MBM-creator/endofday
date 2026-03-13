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
    console.error('[api/jobs/[jobId]/photos] Org lookup failed:', { requestId, orgSlug, supabaseError: supabaseErr });
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
    console.error('[api/jobs/[jobId]/photos] Job lookup failed:', { requestId, jobId, supabaseError: supabaseErr });
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

  const { data: photos, error: photosError } = await supabaseAdmin
    .from('job_pre_commencement_photos')
    .select('id, storage_path, created_at')
    .eq('job_id', jobId)
    .order('created_at', { ascending: true });

  if (photosError) {
    const supabaseErr = normalizeSupabaseError(photosError);
    console.error('[api/jobs/[jobId]/photos] GET list failed:', { requestId, supabaseError: supabaseErr });
    return serverError(requestId, supabaseErr.code ?? 'PHOTOS_LIST', 'Failed to list photos');
  }

  const list = photos ?? [];
  const signedUrlExpiry = 3600; // 1 hour, for display only
  const photosWithUrl: { id: string; storage_path: string; created_at: string; url: string }[] = [];

  for (const row of list) {
    const { data: signed, error: signError } = await supabaseAdmin.storage
      .from(BUCKET)
      .createSignedUrl(row.storage_path, signedUrlExpiry);
    if (signError || !signed?.signedUrl) {
      const supabaseErr = normalizeSupabaseError(signError ?? null);
      console.error('[api/jobs/[jobId]/photos] Signed URL failed:', { requestId, storage_path: row.storage_path, supabaseError: supabaseErr });
      return serverError(requestId, supabaseErr.code ?? 'PHOTO_SIGN', 'Failed to generate photo URL');
    }
    photosWithUrl.push({ ...row, url: signed.signedUrl });
  }

  const res = NextResponse.json({ ok: true, photos: photosWithUrl });
  res.headers.set('x-request-id', requestId);
  return res;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const requestId = request.headers.get('x-vercel-id') ?? randomUUID().slice(0, 8);
  const { jobId } = await params;
  const orgSlug = request.nextUrl.searchParams.get('orgSlug')?.trim() ?? '';

  const validation = await validateJobForOrg(jobId, orgSlug, requestId);
  if (validation instanceof NextResponse) return validation;

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch (parseError) {
    console.error('[api/jobs/[jobId]/photos] Body parse failed:', { requestId, error: parseError });
    return serverError(requestId, 'BODY_PARSE', 'Failed to parse request body');
  }

  const file = formData.get('file') ?? formData.get('photo');
  if (!file || !(file instanceof File) || file.size === 0) {
    return jsonError('One file (field "file" or "photo") is required', 400, requestId);
  }

  const { data: existing, error: countError } = await supabaseAdmin
    .from('job_pre_commencement_photos')
    .select('id')
    .eq('job_id', jobId)
    .limit(MAX_PHOTOS + 1);

  if (countError) {
    const supabaseErr = normalizeSupabaseError(countError);
    console.error('[api/jobs/[jobId]/photos] Count failed:', { requestId, supabaseError: supabaseErr });
    return serverError(requestId, supabaseErr.code ?? 'PHOTOS_COUNT', 'Failed to check photo count');
  }

  if (Array.isArray(existing) && existing.length >= MAX_PHOTOS) {
    return jsonError(`Maximum ${MAX_PHOTOS} pre-commencement photos allowed per job`, 400, requestId);
  }

  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
  const filename = `${randomUUID()}.${ext}`;
  const storagePath = `jobs/${jobId}/pre-commencement/${filename}`;

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
    console.error('[api/jobs/[jobId]/photos] Upload failed:', { requestId, jobId, supabaseError: supabaseErr });
    return serverError(
      requestId,
      supabaseErr.code ?? 'PHOTO_UPLOAD',
      'Failed to upload photo'
    );
  }

  const { data: photo, error: insertError } = await supabaseAdmin
    .from('job_pre_commencement_photos')
    .insert({ job_id: jobId, storage_path: storagePath })
    .select('id, storage_path, created_at')
    .single();

  if (insertError || !photo) {
    const supabaseErr = normalizeSupabaseError(insertError ?? null);
    console.error('[api/jobs/[jobId]/photos] Insert failed:', { requestId, supabaseError: supabaseErr });
    const { error: removeError } = await supabaseAdmin.storage.from(BUCKET).remove([storagePath]);
    if (removeError) {
      console.warn('[api/jobs/[jobId]/photos] Cleanup upload failed:', { requestId, storagePath, removeError });
    }
    return serverError(
      requestId,
      supabaseErr.code ?? 'PHOTO_INSERT',
      'Failed to save photo record'
    );
  }

  const res = NextResponse.json({ ok: true, photo }, { status: 201 });
  res.headers.set('x-request-id', requestId);
  return res;
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const requestId = request.headers.get('x-vercel-id') ?? randomUUID().slice(0, 8);
  const { jobId } = await params;
  const orgSlug = request.nextUrl.searchParams.get('orgSlug')?.trim() ?? '';
  const photoId = request.nextUrl.searchParams.get('photoId')?.trim() ?? '';

  if (!photoId || !isValidUuid(photoId)) {
    return jsonError('photoId is required and must be a valid UUID', 400, requestId);
  }

  const validation = await validateJobForOrg(jobId, orgSlug, requestId);
  if (validation instanceof NextResponse) return validation;

  const { data: photo, error: photoError } = await supabaseAdmin
    .from('job_pre_commencement_photos')
    .select('id, storage_path')
    .eq('id', photoId)
    .eq('job_id', jobId)
    .single();

  if (photoError || !photo) {
    const supabaseErr = normalizeSupabaseError(photoError ?? null);
    console.error('[api/jobs/[jobId]/photos] DELETE photo not found:', { requestId, photoId, jobId, supabaseError: supabaseErr });
    const res = NextResponse.json(
      { ok: false, requestId, message: 'Photo not found' },
      { status: 404 }
    );
    res.headers.set('x-request-id', requestId);
    return res;
  }

  const { error: removeError } = await supabaseAdmin.storage.from(BUCKET).remove([photo.storage_path]);
  if (removeError) {
    const supabaseErr = normalizeSupabaseError(removeError);
    console.error('[api/jobs/[jobId]/photos] DELETE storage failed:', { requestId, storage_path: photo.storage_path, supabaseError: supabaseErr });
    return serverError(requestId, supabaseErr.code ?? 'PHOTO_REMOVE', 'Failed to remove photo');
  }

  const { error: deleteError } = await supabaseAdmin
    .from('job_pre_commencement_photos')
    .delete()
    .eq('id', photoId);

  if (deleteError) {
    const supabaseErr = normalizeSupabaseError(deleteError);
    console.error('[api/jobs/[jobId]/photos] DELETE row failed:', { requestId, photoId, supabaseError: supabaseErr });
    return serverError(requestId, supabaseErr.code ?? 'PHOTO_DELETE', 'Failed to delete photo record');
  }

  const res = NextResponse.json({ ok: true });
  res.headers.set('x-request-id', requestId);
  return res;
}
