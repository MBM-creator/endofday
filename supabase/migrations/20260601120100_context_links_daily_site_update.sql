-- Allow job_daily_site_update as a context_links source type.

ALTER TABLE public.context_links
  DROP CONSTRAINT IF EXISTS context_links_source_type_check;

ALTER TABLE public.context_links
  ADD CONSTRAINT context_links_source_type_check
  CHECK (source_type IN (
    'job_note',
    'job_note_attachment',
    'qa_run',
    'qa_section',
    'daily_report',
    'stage_end_of_day',
    'job_daily_site_update'
  ));
