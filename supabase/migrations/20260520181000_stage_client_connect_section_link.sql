-- Link EOD stages back to Client Connect project sections.
ALTER TABLE public.stages
  ADD COLUMN IF NOT EXISTS cc_project_id UUID,
  ADD COLUMN IF NOT EXISTS cc_section_id UUID,
  ADD COLUMN IF NOT EXISTS cc_section_name_snapshot TEXT,
  ADD COLUMN IF NOT EXISTS cc_section_trade TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_stages_job_cc_section
  ON public.stages(job_id, cc_section_id);

CREATE INDEX IF NOT EXISTS idx_stages_cc_project_id
  ON public.stages(cc_project_id)
  WHERE cc_project_id IS NOT NULL;
