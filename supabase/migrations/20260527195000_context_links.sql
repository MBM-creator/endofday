-- ClickUp-style context links for QA notes, videos, jobs, stages, dates, and crew.

ALTER TABLE public.job_notes
  ADD COLUMN IF NOT EXISTS report_date DATE,
  ADD COLUMN IF NOT EXISTS primary_context_type TEXT,
  ADD COLUMN IF NOT EXISTS primary_context_id UUID;

ALTER TABLE public.job_note_attachments
  ADD COLUMN IF NOT EXISTS primary_context_type TEXT,
  ADD COLUMN IF NOT EXISTS primary_context_id UUID;

CREATE TABLE IF NOT EXISTS public.context_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_type TEXT NOT NULL,
  source_id UUID NOT NULL,
  target_type TEXT NOT NULL,
  target_id UUID,
  target_external_id TEXT,
  target_date DATE,
  relationship_type TEXT NOT NULL DEFAULT 'related',
  created_by UUID REFERENCES public.staff_profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT context_links_target_present_check
    CHECK (target_id IS NOT NULL OR target_external_id IS NOT NULL OR target_date IS NOT NULL),
  CONSTRAINT context_links_source_type_check
    CHECK (source_type IN (
      'job_note',
      'job_note_attachment',
      'qa_run',
      'qa_section',
      'daily_report',
      'stage_end_of_day'
    )),
  CONSTRAINT context_links_target_type_check
    CHECK (target_type IN (
      'organisation',
      'job',
      'cc_project',
      'cc_job',
      'stage',
      'schedule_item',
      'date',
      'crew',
      'job_note',
      'job_note_attachment',
      'qa_run',
      'qa_section',
      'daily_report'
    )),
  CONSTRAINT context_links_relationship_type_check
    CHECK (relationship_type IN (
      'lives_in',
      'also_linked_to',
      'related',
      'scheduled_on',
      'assigned_to',
      'contains',
      'mentions'
    ))
);

CREATE UNIQUE INDEX IF NOT EXISTS context_links_unique_target_id
  ON public.context_links(source_type, source_id, target_type, target_id, relationship_type)
  WHERE target_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS context_links_unique_target_external_id
  ON public.context_links(source_type, source_id, target_type, target_external_id, relationship_type)
  WHERE target_external_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS context_links_unique_target_date
  ON public.context_links(source_type, source_id, target_type, target_date, relationship_type)
  WHERE target_date IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_job_notes_primary_context
  ON public.job_notes(primary_context_type, primary_context_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_job_notes_report_date
  ON public.job_notes(job_id, report_date DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_job_note_attachments_primary_context
  ON public.job_note_attachments(primary_context_type, primary_context_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_context_links_source
  ON public.context_links(source_type, source_id);

CREATE INDEX IF NOT EXISTS idx_context_links_target_id
  ON public.context_links(target_type, target_id);

CREATE INDEX IF NOT EXISTS idx_context_links_target_external_id
  ON public.context_links(target_type, target_external_id);

CREATE INDEX IF NOT EXISTS idx_context_links_target_date
  ON public.context_links(target_date);

UPDATE public.job_notes
SET
  report_date = COALESCE(report_date, created_at::date),
  primary_context_type = COALESCE(primary_context_type, CASE WHEN stage_id IS NOT NULL THEN 'stage' ELSE 'job' END),
  primary_context_id = COALESCE(primary_context_id, stage_id, job_id)
WHERE deleted_at IS NULL;

UPDATE public.job_note_attachments a
SET
  primary_context_type = COALESCE(a.primary_context_type, n.primary_context_type, 'job_note'),
  primary_context_id = COALESCE(a.primary_context_id, n.primary_context_id, a.note_id)
FROM public.job_notes n
WHERE n.id = a.note_id
  AND a.deleted_at IS NULL;

ALTER TABLE public.context_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_all_context_links" ON public.context_links;
CREATE POLICY "service_role_all_context_links"
  ON public.context_links FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
