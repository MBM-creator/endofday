-- =============================================================================
-- Run these in order. Each section is one migration file.
-- =============================================================================

-- =============================================================================
-- 1. 20250222120000_fix_security_linter.sql
-- =============================================================================
-- Fix Supabase Security Advisor issues:
-- 0010: Security Definer View (3 views) -> set security_invoker = on
-- 0013: RLS Disabled in Public (4 tables) -> enable RLS

ALTER TABLE public.organisations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_report_photos ENABLE ROW LEVEL SECURITY;

ALTER VIEW public.daily_reports_reader_v1 SET (security_invoker = on);
ALTER VIEW public.daily_reports_reader_v2 SET (security_invoker = on);
ALTER VIEW public.daily_reports_export_v1 SET (security_invoker = on);


-- =============================================================================
-- 2. 20250222130000_fix_function_search_path.sql
-- =============================================================================
CREATE OR REPLACE FUNCTION public.generate_site_code_hash(site_code TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  RETURN pg_catalog.encode(extensions.digest(site_code, 'sha256'), 'hex');
END;
$$;


-- =============================================================================
-- 3. 20250222140000_rls_policies_for_linter.sql (idempotent)
-- =============================================================================
DROP POLICY IF EXISTS "service_role_all_organisations" ON public.organisations;
CREATE POLICY "service_role_all_organisations"
  ON public.organisations FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "service_role_all_sites" ON public.sites;
CREATE POLICY "service_role_all_sites"
  ON public.sites FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "service_role_all_daily_reports" ON public.daily_reports;
CREATE POLICY "service_role_all_daily_reports"
  ON public.daily_reports FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "service_role_all_daily_report_photos" ON public.daily_report_photos;
CREATE POLICY "service_role_all_daily_report_photos"
  ON public.daily_report_photos FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);


-- =============================================================================
-- 4. 20250303000000_daily_report_drafts.sql
-- =============================================================================
CREATE TABLE IF NOT EXISTS daily_report_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_daily_report_drafts_organisation_id ON daily_report_drafts(organisation_id);
CREATE INDEX IF NOT EXISTS idx_daily_report_drafts_created_at ON daily_report_drafts(created_at);

ALTER TABLE public.daily_report_drafts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_all_daily_report_drafts" ON public.daily_report_drafts;
CREATE POLICY "service_role_all_daily_report_drafts"
  ON public.daily_report_drafts FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);


-- =============================================================================
-- 5. 20250313100000_jobs_stages_job_briefs.sql (STEP 1 - creates stages table)
-- =============================================================================
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


-- =============================================================================
-- 6. 20250313120000_job_pre_commencement_photos.sql
-- =============================================================================
CREATE TABLE IF NOT EXISTS job_pre_commencement_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_job_pre_commencement_photos_job_id ON job_pre_commencement_photos(job_id);

ALTER TABLE public.job_pre_commencement_photos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_all_job_pre_commencement_photos" ON public.job_pre_commencement_photos;
CREATE POLICY "service_role_all_job_pre_commencement_photos"
  ON public.job_pre_commencement_photos FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);


-- =============================================================================
-- 7. 20250314120000_job_active_stage_id.sql (STEP 11)
-- =============================================================================
ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS active_stage_id UUID REFERENCES public.stages(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_jobs_active_stage_id ON public.jobs(active_stage_id) WHERE active_stage_id IS NOT NULL;


-- =============================================================================
-- 8. 20250314140000_checklist_templates.sql (STEP 12)
-- =============================================================================
CREATE TABLE IF NOT EXISTS checklist_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_checklist_templates_organisation_id ON checklist_templates(organisation_id);

CREATE TABLE IF NOT EXISTS checklist_template_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES checklist_templates(id) ON DELETE CASCADE,
  item_type TEXT NOT NULL CHECK (item_type IN ('tools', 'materials', 'qc')),
  label TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_checklist_template_items_template_id ON checklist_template_items(template_id);

ALTER TABLE public.checklist_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checklist_template_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_all_checklist_templates" ON public.checklist_templates;
CREATE POLICY "service_role_all_checklist_templates"
  ON public.checklist_templates FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "service_role_all_checklist_template_items" ON public.checklist_template_items;
CREATE POLICY "service_role_all_checklist_template_items"
  ON public.checklist_template_items FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);


-- =============================================================================
-- 9. 20250314150000_replace_checklist_template_items_atomic.sql
-- =============================================================================
CREATE OR REPLACE FUNCTION replace_checklist_template_items(
  p_template_id UUID,
  p_items JSONB
)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  DELETE FROM checklist_template_items WHERE template_id = p_template_id;
  IF jsonb_array_length(p_items) > 0 THEN
    INSERT INTO checklist_template_items (template_id, item_type, label, sort_order)
    SELECT
      p_template_id,
      (elem->>'type'),
      (elem->>'label'),
      (ord - 1)::integer
    FROM jsonb_array_elements(p_items) WITH ORDINALITY AS t(elem, ord);
  END IF;
END;
$$;


-- =============================================================================
-- 10. 20250315100000_stages_checklist_template_id.sql (STEP 13)
-- =============================================================================
ALTER TABLE stages
  ADD COLUMN IF NOT EXISTS checklist_template_id UUID REFERENCES checklist_templates(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_stages_checklist_template_id ON stages(checklist_template_id);
