-- STEP 11: One active stage per job.
ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS active_stage_id UUID REFERENCES public.stages(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_jobs_active_stage_id ON public.jobs(active_stage_id) WHERE active_stage_id IS NOT NULL;
