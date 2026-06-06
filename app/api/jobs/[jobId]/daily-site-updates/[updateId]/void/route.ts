import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { validateJobForOrg, normalizeSupabaseError, isValidUuid } from '@/lib/job-org-validation';
import { mapDailySiteUpdateRow, type DailySiteUpdateDbRow } from '@/lib/daily-site-update';
import { requireSupervisorOrAdmin } from '@/lib/staff-auth';

export const runtime = 'nodejs';

const UPDATE_SELECT = `
  id,
  job_id,
  stage_id,
  author_staff_profile_id,
  report_date,
  report_timezone,
  submitted_at,
  created_at,
  progress_today,
  issues_faced,
  issues_faced_none,
  problems_resolved,
  problems_resolved_none,
  prevention_plan,
  prevention_plan_none,
  on_track_status,
  on_track_notes,
  planned_hours_snapshot,
  hours_used_snapshot,
  hours_remaining_snapshot,
  hours_source,
  supersedes_update_id,
  voided_at,
  voided_by_staff_profile_id,
  void_reason,
  staff_profiles!job_daily_site_updates_author_staff_profile_id_fkey(full_name),
  stages(name)
`;

function jsonError(message: string, status = 400, requestId?: string) {
  const res = NextResponse.json({ ok: false, message, requestId }, { status });
  if (requestId) res.headers.set('x-request-id', requestId);
  return res;
}

function serverError(requestId: string, errorCode: string, message = 'Internal server error') {
  const res = NextResponse.json({ ok: false, requestId, errorCode, message }, { status: 500 });
  res.headers.set('x-request-id', requestId);
  return res;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string; updateId: string }> }
) {
  const requestId = request.headers.get('x-vercel-id') ?? randomUUID().slice(0, 8);
  const { jobId, updateId } = await params;
  const orgSlug = request.nextUrl.searchParams.get('orgSlug')?.trim() ?? '';

  const staffAuth = await requireSupervisorOrAdmin(orgSlug);
  if (staffAuth instanceof NextResponse) {
    staffAuth.headers.set('x-request-id', requestId);
    return staffAuth;
  }

  if (!updateId || !isValidUuid(updateId)) {
    return jsonError('Update not found', 404, requestId);
  }

  const validation = await validateJobForOrg(jobId, orgSlug, requestId);
  if (validation instanceof NextResponse) return validation;

  let body: { voidReason?: unknown } = {};
  try {
    const raw = await request.json();
    body = typeof raw === 'object' && raw !== null ? raw : {};
  } catch {
    return jsonError('Invalid JSON body', 400, requestId);
  }

  const voidReason = String(body.voidReason ?? '').trim();
  if (!voidReason) {
    return jsonError('voidReason is required', 400, requestId);
  }
  if (voidReason.length > 2000) {
    return jsonError('voidReason must be at most 2000 characters', 400, requestId);
  }

  const { data: existing, error: existingError } = await supabaseAdmin
    .from('job_daily_site_updates')
    .select('id, job_id, voided_at')
    .eq('id', updateId)
    .eq('job_id', jobId)
    .maybeSingle();

  if (existingError || !existing) {
    return jsonError('Update not found', 404, requestId);
  }

  if (existing.voided_at) {
    return jsonError('This update has already been voided', 400, requestId);
  }

  const now = new Date().toISOString();
  const { data: updated, error: updateError } = await supabaseAdmin
    .from('job_daily_site_updates')
    .update({
      voided_at: now,
      voided_by_staff_profile_id: staffAuth.staff.id,
      void_reason: voidReason,
    })
    .eq('id', updateId)
    .eq('job_id', jobId)
    .select(UPDATE_SELECT)
    .single();

  if (updateError || !updated) {
    const supabaseErr = normalizeSupabaseError(updateError ?? null);
    console.error('[api/jobs/[jobId]/daily-site-updates/[updateId]/void] PATCH failed:', {
      requestId,
      supabaseError: supabaseErr,
    });
    return serverError(requestId, supabaseErr.code ?? 'DSU_VOID', 'Failed to void daily site update');
  }

  const update = mapDailySiteUpdateRow(
    updated as DailySiteUpdateDbRow,
    staffAuth.staff.role
  );

  const res = NextResponse.json({ ok: true, update });
  res.headers.set('x-request-id', requestId);
  return res;
}
