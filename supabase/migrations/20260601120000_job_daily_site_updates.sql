-- QA-owned Daily Site Updates (append-only narrative; labour snapshots read-only).

CREATE TABLE IF NOT EXISTS public.job_daily_site_updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  stage_id UUID NULL REFERENCES public.stages(id) ON DELETE SET NULL,
  author_staff_profile_id UUID NOT NULL REFERENCES public.staff_profiles(id) ON DELETE RESTRICT,
  report_date DATE NOT NULL,
  report_timezone TEXT NOT NULL DEFAULT 'Australia/Melbourne',
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  progress_today TEXT NOT NULL,
  issues_faced TEXT NOT NULL,
  issues_faced_none BOOLEAN NOT NULL DEFAULT false,
  problems_resolved TEXT NOT NULL,
  problems_resolved_none BOOLEAN NOT NULL DEFAULT false,
  prevention_plan TEXT NOT NULL,
  prevention_plan_none BOOLEAN NOT NULL DEFAULT false,

  on_track_status TEXT NOT NULL CHECK (
    on_track_status IN ('on_track', 'at_risk', 'off_track', 'unknown')
  ),
  on_track_notes TEXT,

  planned_hours_snapshot NUMERIC NULL,
  hours_used_snapshot NUMERIC NULL,
  hours_remaining_snapshot NUMERIC NULL,
  hours_source TEXT NULL CHECK (
    hours_source IN ('manual_read_only', 'stage_labour_read_only', 'jibble')
  ),

  supersedes_update_id UUID NULL REFERENCES public.job_daily_site_updates(id),
  voided_at TIMESTAMPTZ NULL,
  voided_by_staff_profile_id UUID NULL REFERENCES public.staff_profiles(id),
  void_reason TEXT NULL
);

CREATE INDEX IF NOT EXISTS idx_job_daily_site_updates_job_date
  ON public.job_daily_site_updates (job_id, report_date DESC);

CREATE INDEX IF NOT EXISTS idx_job_daily_site_updates_author_date
  ON public.job_daily_site_updates (author_staff_profile_id, report_date DESC);

CREATE INDEX IF NOT EXISTS idx_job_daily_site_updates_stage_date
  ON public.job_daily_site_updates (stage_id, report_date DESC)
  WHERE stage_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_job_daily_site_updates_not_voided
  ON public.job_daily_site_updates (job_id, submitted_at DESC)
  WHERE voided_at IS NULL;

ALTER TABLE public.job_daily_site_updates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_all_job_daily_site_updates" ON public.job_daily_site_updates;
CREATE POLICY "service_role_all_job_daily_site_updates"
  ON public.job_daily_site_updates FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
