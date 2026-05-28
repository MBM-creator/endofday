-- Allow fencing QA runs to coexist with paving and irrigation in the shared QA run tables.
ALTER TABLE public.paving_qa_runs
  DROP CONSTRAINT IF EXISTS paving_qa_runs_qa_type_check;

ALTER TABLE public.paving_qa_runs
  ADD CONSTRAINT paving_qa_runs_qa_type_check
  CHECK (qa_type IN ('paving', 'irrigation', 'fencing'));

COMMENT ON COLUMN public.paving_qa_runs.qa_type IS
  'QA checklist family for this run. Existing table name is retained for compatibility; values are paving, irrigation or fencing.';
