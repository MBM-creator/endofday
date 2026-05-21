-- STEP 29: Client Connect project link fields on jobs.
-- Nullable fields; no foreign keys to external Client Connect schema.

ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS cc_project_id UUID,
  ADD COLUMN IF NOT EXISTS cc_client_id UUID,
  ADD COLUMN IF NOT EXISTS cc_project_title_snapshot TEXT,
  ADD COLUMN IF NOT EXISTS cc_client_name_snapshot TEXT;

