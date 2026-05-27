import { supabaseAdmin } from '@/lib/supabase-admin';

export type ContextSourceType =
  | 'job_note'
  | 'job_note_attachment'
  | 'qa_run'
  | 'qa_section'
  | 'daily_report'
  | 'stage_end_of_day';

export type ContextTargetType =
  | 'organisation'
  | 'job'
  | 'cc_project'
  | 'cc_job'
  | 'stage'
  | 'schedule_item'
  | 'date'
  | 'crew'
  | 'job_note'
  | 'job_note_attachment'
  | 'qa_run'
  | 'qa_section'
  | 'daily_report';

export interface ContextLinkInput {
  sourceType: ContextSourceType;
  sourceId: string;
  targetType: ContextTargetType;
  targetId?: string | null;
  targetExternalId?: string | null;
  targetDate?: string | null;
  relationshipType?: string;
  createdBy?: string | null;
}

function scheduleItemKey(stageId: string | null, reportDate: string | null): string | null {
  if (!stageId || !reportDate) return null;
  return `stage:${stageId}:date:${reportDate}`;
}

export async function createContextLinks(links: ContextLinkInput[]) {
  const rows = links
    .filter((link) => link.targetId || link.targetExternalId || link.targetDate)
    .map((link) => ({
      source_type: link.sourceType,
      source_id: link.sourceId,
      target_type: link.targetType,
      target_id: link.targetId ?? null,
      target_external_id: link.targetExternalId ?? null,
      target_date: link.targetDate ?? null,
      relationship_type: link.relationshipType ?? 'related',
      created_by: link.createdBy ?? null,
    }));

  if (rows.length === 0) return;

  for (const row of rows) {
    const { error } = await supabaseAdmin.from('context_links').insert(row);
    if (error && error.code !== '23505') {
      throw error;
    }
  }
}

export async function linkJobNoteContext(args: {
  noteId: string;
  organisationId: string;
  jobId: string;
  stageId: string | null;
  reportDate: string | null;
  staffProfileId: string | null;
  ccProjectId?: string | null;
  ccJobId?: string | null;
}) {
  await createContextLinks([
    {
      sourceType: 'job_note',
      sourceId: args.noteId,
      targetType: 'organisation',
      targetId: args.organisationId,
      relationshipType: 'also_linked_to',
      createdBy: args.staffProfileId,
    },
    {
      sourceType: 'job_note',
      sourceId: args.noteId,
      targetType: 'job',
      targetId: args.jobId,
      relationshipType: 'lives_in',
      createdBy: args.staffProfileId,
    },
    {
      sourceType: 'job_note',
      sourceId: args.noteId,
      targetType: 'stage',
      targetId: args.stageId,
      relationshipType: 'also_linked_to',
      createdBy: args.staffProfileId,
    },
    {
      sourceType: 'job_note',
      sourceId: args.noteId,
      targetType: 'schedule_item',
      targetExternalId: scheduleItemKey(args.stageId, args.reportDate),
      relationshipType: 'scheduled_on',
      createdBy: args.staffProfileId,
    },
    {
      sourceType: 'job_note',
      sourceId: args.noteId,
      targetType: 'date',
      targetDate: args.reportDate,
      relationshipType: 'scheduled_on',
      createdBy: args.staffProfileId,
    },
    {
      sourceType: 'job_note',
      sourceId: args.noteId,
      targetType: 'crew',
      targetId: args.staffProfileId,
      relationshipType: 'assigned_to',
      createdBy: args.staffProfileId,
    },
    {
      sourceType: 'job_note',
      sourceId: args.noteId,
      targetType: 'cc_project',
      targetExternalId: args.ccProjectId,
      relationshipType: 'also_linked_to',
      createdBy: args.staffProfileId,
    },
    {
      sourceType: 'job_note',
      sourceId: args.noteId,
      targetType: 'cc_job',
      targetExternalId: args.ccJobId,
      relationshipType: 'also_linked_to',
      createdBy: args.staffProfileId,
    },
  ]);
}

export async function linkJobNoteAttachmentContext(args: {
  attachmentId: string;
  noteId: string;
  organisationId: string;
  jobId: string;
  stageId: string | null;
  reportDate: string | null;
  staffProfileId: string | null;
}) {
  await createContextLinks([
    {
      sourceType: 'job_note_attachment',
      sourceId: args.attachmentId,
      targetType: 'job_note',
      targetId: args.noteId,
      relationshipType: 'lives_in',
      createdBy: args.staffProfileId,
    },
    {
      sourceType: 'job_note_attachment',
      sourceId: args.attachmentId,
      targetType: 'organisation',
      targetId: args.organisationId,
      relationshipType: 'also_linked_to',
      createdBy: args.staffProfileId,
    },
    {
      sourceType: 'job_note_attachment',
      sourceId: args.attachmentId,
      targetType: 'job',
      targetId: args.jobId,
      relationshipType: 'also_linked_to',
      createdBy: args.staffProfileId,
    },
    {
      sourceType: 'job_note_attachment',
      sourceId: args.attachmentId,
      targetType: 'stage',
      targetId: args.stageId,
      relationshipType: 'also_linked_to',
      createdBy: args.staffProfileId,
    },
    {
      sourceType: 'job_note_attachment',
      sourceId: args.attachmentId,
      targetType: 'schedule_item',
      targetExternalId: scheduleItemKey(args.stageId, args.reportDate),
      relationshipType: 'scheduled_on',
      createdBy: args.staffProfileId,
    },
    {
      sourceType: 'job_note_attachment',
      sourceId: args.attachmentId,
      targetType: 'date',
      targetDate: args.reportDate,
      relationshipType: 'scheduled_on',
      createdBy: args.staffProfileId,
    },
    {
      sourceType: 'job_note_attachment',
      sourceId: args.attachmentId,
      targetType: 'crew',
      targetId: args.staffProfileId,
      relationshipType: 'assigned_to',
      createdBy: args.staffProfileId,
    },
  ]);
}
