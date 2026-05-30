import { supabaseAdmin } from '@/lib/supabase-admin';
import type { CcProject } from '@/lib/cc-client';

type SyncResult = {
  syncedStageIds: string[];
  activeStageId: string | null;
};

export async function syncCcProjectStagesForJob(
  jobId: string,
  project: CcProject,
  requestId: string
): Promise<SyncResult> {
  if (project.sections.length === 0) {
    return { syncedStageIds: [], activeStageId: null };
  }

  const orderedSections = [...project.sections].sort((a, b) => {
    const aIsDemo = isDemoSection(a.name, a.trade);
    const bIsDemo = isDemoSection(b.name, b.trade);
    if (aIsDemo !== bIsDemo) return aIsDemo ? -1 : 1;
    return project.sections.indexOf(a) - project.sections.indexOf(b);
  });

  const rows = orderedSections.map((section, index) => ({
    job_id: jobId,
    name: section.name,
    sort_order: index,
    cc_project_id: project.project_id,
    cc_section_id: section.id,
    cc_section_name_snapshot: section.name,
    cc_section_trade: section.trade,
  }));

  const { data: stages, error: upsertError } = await supabaseAdmin
    .from('stages')
    .upsert(rows, { onConflict: 'job_id,cc_section_id' })
    .select('id, cc_section_id');

  if (upsertError) {
    console.error('[CC STAGE SYNC] upsert failed', {
      requestId,
      jobId,
      projectId: project.project_id,
      error: upsertError,
    });
    throw new Error('Failed to sync Client Connect sections to stages');
  }

  const stagesBySectionId = new Map(
    (stages ?? [])
      .filter(
        (stage): stage is { id: string; cc_section_id: string } =>
          typeof stage.id === 'string' && typeof stage.cc_section_id === 'string'
      )
      .map((stage) => [stage.cc_section_id, stage])
  );
  const syncedStageIds = orderedSections
    .map((section) => stagesBySectionId.get(section.id)?.id)
    .filter((id): id is string => typeof id === 'string');

  const firstStageId = syncedStageIds[0] ?? null;
  if (!firstStageId) {
    return { syncedStageIds, activeStageId: null };
  }

  const { data: job, error: jobError } = await supabaseAdmin
    .from('jobs')
    .select('active_stage_id')
    .eq('id', jobId)
    .single();

  if (jobError) {
    console.error('[CC STAGE SYNC] job active stage lookup failed', {
      requestId,
      jobId,
      error: jobError,
    });
    throw new Error('Failed to load job active stage');
  }

  let shouldSetActiveStage = true;
  if (job?.active_stage_id) {
    const { data: activeStage } = await supabaseAdmin
      .from('stages')
      .select('id, cc_project_id')
      .eq('id', job.active_stage_id)
      .maybeSingle();
    shouldSetActiveStage = activeStage?.cc_project_id !== project.project_id;
  }

  if (shouldSetActiveStage) {
    const { error: activeError } = await supabaseAdmin
      .from('jobs')
      .update({ active_stage_id: firstStageId })
      .eq('id', jobId);

    if (activeError) {
      console.error('[CC STAGE SYNC] active stage update failed', {
        requestId,
        jobId,
        firstStageId,
        error: activeError,
      });
      throw new Error('Failed to set active Client Connect stage');
    }
  }

  return {
    syncedStageIds,
    activeStageId: shouldSetActiveStage ? firstStageId : job?.active_stage_id ?? null,
  };
}

function isDemoSection(name: string, trade?: string | null): boolean {
  const text = `${name} ${trade ?? ''}`.toLowerCase().replace(/[_-]+/g, ' ');
  return /\b(demo|demolition)\b/.test(text);
}
