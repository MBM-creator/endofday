ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS hidden_from_qa_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_jobs_visible_qa
  ON public.jobs(organisation_id, created_at DESC)
  WHERE hidden_from_qa_at IS NULL;
