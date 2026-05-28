-- Add setup_version to paving_qa_runs.
-- Existing rows (v1/legacy) remain NULL — treated as v1 by the application.
-- New v2 runs must be created with setup_version = 2.

ALTER TABLE public.paving_qa_runs
  ADD COLUMN IF NOT EXISTS setup_version SMALLINT;

COMMENT ON COLUMN public.paving_qa_runs.setup_version IS
  'Schema version for the setup JSONB. NULL = v1/legacy. 2 = v2 supervisor-led wizard.';
