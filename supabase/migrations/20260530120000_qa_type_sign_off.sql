-- Allow supervisor sign-off QA runs when no trade-specific checklist applies.

ALTER TABLE public.paving_qa_runs
  DROP CONSTRAINT IF EXISTS paving_qa_runs_qa_type_check;

ALTER TABLE public.paving_qa_runs
  ADD CONSTRAINT paving_qa_runs_qa_type_check
  CHECK (qa_type IN ('paving', 'irrigation', 'fencing', 'sign_off'));

COMMENT ON COLUMN public.paving_qa_runs.qa_type IS
  'QA run type: paving, irrigation, fencing, or sign_off (supervisor sign-off when no trade checklist applies).';
