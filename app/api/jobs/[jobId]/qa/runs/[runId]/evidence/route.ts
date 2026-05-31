import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { validateJobForOrg, normalizeSupabaseError, isValidUuid } from '@/lib/job-org-validation';
import { requireSupervisorOrAdmin } from '@/lib/staff-auth';
import { loadQaRunBundle } from '@/lib/qa-run-bundle';
import { computeSectionStatesFromBundle } from '@/lib/admin-dashboard/compute-section-states';
import { qaTypeLabel } from '@/lib/admin-dashboard/qa-links';

export const runtime = 'nodejs';

function jsonError(message: string, status = 400, requestId?: string) {
  const res = NextResponse.json({ ok: false, message }, { status });
  if (requestId) res.headers.set('x-request-id', requestId);
  return res;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string; runId: string }> }
) {
  const requestId = request.headers.get('x-vercel-id') ?? randomUUID().slice(0, 8);
  const { jobId, runId } = await params;
  const orgSlug = request.nextUrl.searchParams.get('orgSlug')?.trim() ?? '';

  const staffAuth = await requireSupervisorOrAdmin(orgSlug);
  if (staffAuth instanceof NextResponse) {
    staffAuth.headers.set('x-request-id', requestId);
    return staffAuth;
  }

  if (!isValidUuid(runId)) return jsonError('Run not found', 404, requestId);

  const v = await validateJobForOrg(jobId, orgSlug, requestId);
  if (v instanceof NextResponse) {
    v.headers.set('x-request-id', requestId);
    return v;
  }

  const bundle = await loadQaRunBundle(runId, jobId);
  if (!bundle.ok) return jsonError('Run not found', 404, requestId);

  const sectionStates = computeSectionStatesFromBundle(bundle);

  const { data: photoRows, error: photoErr } = await supabaseAdmin
    .from('paving_qa_photos')
    .select('id, section_code, item_key, content_type, created_at')
    .eq('run_id', runId)
    .order('created_at', { ascending: true });

  if (photoErr) {
    console.error('[qa/evidence GET]', { requestId, error: normalizeSupabaseError(photoErr) });
    return jsonError('Failed to load evidence', 500, requestId);
  }

  const photosBySection = new Map<string, Array<{ id: string; item_key: string; content_type: string | null; created_at: string }>>();
  for (const row of photoRows ?? []) {
    const sectionCode = row.section_code as string;
    if (!photosBySection.has(sectionCode)) photosBySection.set(sectionCode, []);
    photosBySection.get(sectionCode)!.push({
      id: row.id as string,
      item_key: row.item_key as string,
      content_type: (row.content_type as string | null) ?? null,
      created_at: row.created_at as string,
    });
  }

  const { data: issueRows } = await supabaseAdmin
    .from('paving_qa_issues')
    .select('id, section_code, item_key, status, title, detail')
    .eq('run_id', runId);

  const issuesBySection = new Map<string, Array<{ id: string; item_key: string; status: string; title: string | null; detail: string | null }>>();
  for (const row of issueRows ?? []) {
    const sectionCode = row.section_code as string;
    if (!issuesBySection.has(sectionCode)) issuesBySection.set(sectionCode, []);
    issuesBySection.get(sectionCode)!.push({
      id: row.id as string,
      item_key: row.item_key as string,
      status: row.status as string,
      title: (row.title as string | null) ?? null,
      detail: (row.detail as string | null) ?? null,
    });
  }

  const notesBySection: Record<string, Array<{ itemKey: string; note: string }>> = {};
  for (const submission of bundle.submissions) {
    const notes: Array<{ itemKey: string; note: string }> = [];
    for (const [itemKey, answer] of Object.entries(submission.answers ?? {})) {
      const note = typeof answer?.note === 'string' ? answer.note.trim() : '';
      if (note) notes.push({ itemKey, note });
    }
    if (notes.length > 0) notesBySection[submission.section_code] = notes;
  }

  const sections = sectionStates.map((section) => ({
    code: section.code,
    title: section.title,
    status: section.status,
    cleared: section.cleared,
    photoCount: photosBySection.get(section.code)?.length ?? 0,
    issueCount: issuesBySection.get(section.code)?.length ?? 0,
    notes: notesBySection[section.code] ?? [],
    issues: issuesBySection.get(section.code) ?? [],
  }));

  const res = NextResponse.json({
    ok: true,
    job: {
      id: v.job.id,
      name: v.job.name,
      cc_project_title_snapshot: v.job.cc_project_title_snapshot ?? null,
      cc_client_name_snapshot: v.job.cc_client_name_snapshot ?? null,
    },
    run: {
      id: bundle.run.id,
      status: bundle.run.status,
      qa_type: bundle.qaType,
      qa_type_label: qaTypeLabel(bundle.qaType),
      setup_version: bundle.run.setup_version,
      started_at: bundle.run.started_at,
      updated_at: bundle.run.updated_at,
    },
    sections,
  });
  res.headers.set('x-request-id', requestId);
  return res;
}
