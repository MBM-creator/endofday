-- STEP 1: Jobs, stages, job_briefs and optional stage link on daily_reports.
-- No app behaviour change; existing reports keep stage_id NULL.

-- Jobs (office-created; one per organisation/site or logical unit)
CREATE TABLE IF NOT EXISTS jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  site_id UUID REFERENCES sites(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_jobs_organisation_id ON jobs(organisation_id);
CREATE INDEX IF NOT EXISTS idx_jobs_site_id ON jobs(site_id);

-- Stages (office-created; belong to a job; reports will link here)
CREATE TABLE IF NOT EXISTS stages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stages_job_id ON stages(job_id);

-- Job briefs (one per job; content for field reference)
CREATE TABLE IF NOT EXISTS job_briefs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  content TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(job_id)
);

-- Optional link from daily_reports to a stage (nullable; existing rows unchanged)
ALTER TABLE daily_reports
  ADD COLUMN IF NOT EXISTS stage_id UUID REFERENCES stages(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_daily_reports_stage_id ON daily_reports(stage_id);

-- RLS and service_role policies (consistent with existing tables)
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_briefs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all_jobs"
  ON public.jobs FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "service_role_all_stages"
  ON public.stages FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "service_role_all_job_briefs"
  ON public.job_briefs FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
