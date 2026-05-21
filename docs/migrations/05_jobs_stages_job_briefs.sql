-- 20250313100000_jobs_stages_job_briefs.sql (STEP 1 - creates jobs, stages, job_briefs)
CREATE TABLE IF NOT EXISTS jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  site_id UUID REFERENCES sites(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_jobs_organisation_id ON jobs(organisation_id);
CREATE INDEX IF NOT EXISTS idx_jobs_site_id ON jobs(site_id);

CREATE TABLE IF NOT EXISTS stages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stages_job_id ON stages(job_id);

CREATE TABLE IF NOT EXISTS job_briefs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  content TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(job_id)
);

ALTER TABLE daily_reports
  ADD COLUMN IF NOT EXISTS stage_id UUID REFERENCES stages(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_daily_reports_stage_id ON daily_reports(stage_id);

ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_briefs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_all_jobs" ON public.jobs;
CREATE POLICY "service_role_all_jobs"
  ON public.jobs FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "service_role_all_stages" ON public.stages;
CREATE POLICY "service_role_all_stages"
  ON public.stages FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "service_role_all_job_briefs" ON public.job_briefs;
CREATE POLICY "service_role_all_job_briefs"
  ON public.job_briefs FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
