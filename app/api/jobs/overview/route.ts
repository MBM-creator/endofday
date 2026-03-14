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

type JobOverviewEntry = {
  id: string;
  name: string;
  activeStageName: string | null;
  checklistCompleted: number;
  checklistTotal: number;
  hasDailyNote: boolean;
  eodSubmittedToday: boolean;
  activeStageLastUpdatedAt: string | null;
};

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
    console.error('[api/jobs/overview] Org lookup failed:', { requestId, orgSlug, supabaseError: supabaseErr });
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

  const { data: jobs, error: jobsError } = await supabaseAdmin
    .from('jobs')
    .select('id, name, active_stage_id')
    .eq('organisation_id', org.id)
    .order('created_at', { ascending: false });

  if (jobsError) {
    const supabaseErr = normalizeSupabaseError(jobsError);
    console.error('[api/jobs/overview] Jobs fetch failed:', { requestId, supabaseError: supabaseErr });
    return serverError(requestId, supabaseErr.code ?? 'JOBS_GET', 'Failed to load jobs');
  }

  const jobsList = jobs ?? [];
  if (jobsList.length === 0) {
    const res = NextResponse.json({ ok: true, jobs: [] });
    res.headers.set('x-request-id', requestId);
    return res;
  }

  const jobIds = jobsList.map((j: { id: string }) => j.id);

  const { data: stages, error: stagesError } = await supabaseAdmin
    .from('stages')
    .select('id, job_id, name, daily_note, daily_note_updated_at, checklist_templates(name, checklist_template_items(id))')
    .in('job_id', jobIds)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });

  if (stagesError) {
    const supabaseErr = normalizeSupabaseError(stagesError);
    console.error('[api/jobs/overview] Stages fetch failed:', { requestId, supabaseError: supabaseErr });
    return serverError(requestId, supabaseErr.code ?? 'STAGES_GET', 'Failed to load stages');
  }

  const stagesList = stages ?? [];
  const activeStageIds = jobsList
    .map((j: { active_stage_id?: string | null }) => j.active_stage_id)
    .filter((id: string | null | undefined): id is string => id != null && id !== '');

  let completionsRows: { stage_id: string; checklist_template_item_id: string; completed_at?: string }[] = [];
  if (activeStageIds.length > 0) {
    const { data: compRows, error: compErr } = await supabaseAdmin
      .from('stage_checklist_completions')
      .select('stage_id, checklist_template_item_id, completed_at')
      .in('stage_id', activeStageIds);
    if (!compErr && compRows) {
      completionsRows = compRows.filter(
        (r): r is { stage_id: string; checklist_template_item_id: string; completed_at?: string } =>
          typeof r.stage_id === 'string' && typeof r.checklist_template_item_id === 'string'
      );
    }
  }

  const todayUtc = new Date().toISOString().slice(0, 10);
  const eodSubmittedAtByStage = new Map<string, string>();
  if (activeStageIds.length > 0) {
    const { data: eodRows, error: eodErr } = await supabaseAdmin
      .from('stage_end_of_day')
      .select('stage_id, submitted_at')
      .in('stage_id', activeStageIds)
      .eq('report_date', todayUtc);
    if (!eodErr && eodRows) {
      for (const row of eodRows) {
        if (typeof row.stage_id === 'string' && typeof row.submitted_at === 'string') {
          eodSubmittedAtByStage.set(row.stage_id, row.submitted_at);
        }
      }
    }
  }
  const eodStageIds = new Set(eodSubmittedAtByStage.keys());

  const stagesByJob = new Map<string, typeof stagesList[0][]>();
  for (const s of stagesList) {
    const jid = s.job_id;
    if (!jid) continue;
    if (!stagesByJob.has(jid)) stagesByJob.set(jid, []);
    stagesByJob.get(jid)!.push(s);
  }

  const completedCountByStage = new Map<string, number>();
  for (const stage of stagesList) {
    const stageId = stage.id;
    const template = Array.isArray(stage.checklist_templates) ? stage.checklist_templates[0] : stage.checklist_templates;
    const items = template?.checklist_template_items;
    const itemIds = Array.isArray(items) ? items.map((i: { id?: string }) => i.id).filter((id): id is string => typeof id === 'string') : [];
    const itemIdSet = new Set(itemIds);
    const count = completionsRows.filter(
      (r) => r.stage_id === stageId && itemIdSet.has(r.checklist_template_item_id)
    ).length;
    completedCountByStage.set(stageId, count);
  }

  const overview: JobOverviewEntry[] = jobsList.map((job: { id: string; name: string; active_stage_id?: string | null }) => {
    const activeStageId = job.active_stage_id ?? null;
    if (!activeStageId) {
      return {
        id: job.id,
        name: job.name,
        activeStageName: null,
        checklistCompleted: 0,
        checklistTotal: 0,
        hasDailyNote: false,
        eodSubmittedToday: false,
        activeStageLastUpdatedAt: null,
      };
    }
    const jobStages = stagesByJob.get(job.id) ?? [];
    const activeStage = jobStages.find((s: { id: string }) => s.id === activeStageId);
    if (!activeStage) {
      return {
        id: job.id,
        name: job.name,
        activeStageName: null,
        checklistCompleted: 0,
        checklistTotal: 0,
        hasDailyNote: false,
        eodSubmittedToday: false,
        activeStageLastUpdatedAt: null,
      };
    }
    const activeTemplate = Array.isArray(activeStage.checklist_templates) ? activeStage.checklist_templates[0] : activeStage.checklist_templates;
    const items = activeTemplate?.checklist_template_items;
    const checklistTotal = Array.isArray(items) ? items.length : 0;
    const checklistCompleted = completedCountByStage.get(activeStage.id) ?? 0;
    const hasDailyNote = ((activeStage.daily_note ?? '').trim() !== '');
    const eodSubmittedToday = eodStageIds.has(activeStage.id);
    const itemIds = Array.isArray(items) ? items.map((i: { id?: string }) => i.id).filter((id): id is string => typeof id === 'string') : [];
    const itemIdSet = new Set(itemIds);
    const completionTimestamps = completionsRows
      .filter((r) => r.stage_id === activeStage.id && itemIdSet.has(r.checklist_template_item_id) && typeof r.completed_at === 'string')
      .map((r) => new Date(r.completed_at!).getTime())
      .filter((t) => !Number.isNaN(t));
    const dailyNoteTs = typeof activeStage.daily_note_updated_at === 'string' ? new Date(activeStage.daily_note_updated_at).getTime() : NaN;
    const eodTs = eodSubmittedAtByStage.get(activeStage.id);
    const eodTsNum = typeof eodTs === 'string' ? new Date(eodTs).getTime() : NaN;
    const allTs = [...completionTimestamps, ...(Number.isNaN(dailyNoteTs) ? [] : [dailyNoteTs]), ...(Number.isNaN(eodTsNum) ? [] : [eodTsNum])];
    const latestTs = allTs.length > 0 ? Math.max(...allTs) : NaN;
    const activeStageLastUpdatedAt = Number.isNaN(latestTs) ? null : new Date(latestTs).toISOString();
    return {
      id: job.id,
      name: job.name,
      activeStageName: activeStage.name ?? null,
      checklistCompleted,
      checklistTotal,
      hasDailyNote,
      eodSubmittedToday,
      activeStageLastUpdatedAt,
    };
  });

  const res = NextResponse.json({ ok: true, jobs: overview });
  res.headers.set('x-request-id', requestId);
  return res;
}
