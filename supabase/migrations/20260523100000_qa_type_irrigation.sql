-- Add a QA type discriminator so paving and irrigation QA runs can coexist.
ALTER TABLE public.paving_qa_runs
  ADD COLUMN IF NOT EXISTS qa_type TEXT NOT NULL DEFAULT 'paving';

UPDATE public.paving_qa_runs
SET qa_type = 'paving'
WHERE qa_type IS NULL OR qa_type = '';

ALTER TABLE public.paving_qa_runs
  DROP CONSTRAINT IF EXISTS paving_qa_runs_qa_type_check;

ALTER TABLE public.paving_qa_runs
  ADD CONSTRAINT paving_qa_runs_qa_type_check
  CHECK (qa_type IN ('paving', 'irrigation'));

DROP INDEX IF EXISTS idx_paving_qa_runs_one_active_per_job;

CREATE UNIQUE INDEX IF NOT EXISTS idx_paving_qa_runs_one_active_per_job_type
  ON public.paving_qa_runs (job_id, qa_type)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_paving_qa_runs_job_type_status
  ON public.paving_qa_runs(job_id, qa_type, status);

COMMENT ON COLUMN public.paving_qa_runs.qa_type IS
  'QA checklist family for this run. Existing table name is retained for compatibility; values are paving or irrigation.';
