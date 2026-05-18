-- Paving QA Evidence v1: runs, submissions, photos, issues, supervisor audit events.
-- Catalogue lives in TypeScript; RLS follows service_role-only pattern.

-- Run lifecycle
CREATE TYPE paving_qa_run_status AS ENUM ('active', 'completed', 'cancelled');

-- Crew submission row (submitted != cleared; cleared is computed server-side)
CREATE TYPE paving_qa_submission_status AS ENUM ('draft', 'submitted', 'returned');

CREATE TYPE paving_qa_item_result AS ENUM ('pass', 'fail', 'na');

CREATE TYPE paving_qa_issue_severity AS ENUM ('critical', 'non_critical');

CREATE TYPE paving_qa_issue_status AS ENUM (
  'open',
  'rectification_required',
  'evidence_requested',
  'resolved_approved',
  'proceed_approved'
);

CREATE TYPE paving_qa_supervisor_action AS ENUM (
  'request_evidence',
  'require_rectification',
  'approve_rectification',
  'approve_to_proceed',
  'final_approval'
);

CREATE TABLE IF NOT EXISTS paving_qa_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  stage_id UUID REFERENCES stages(id) ON DELETE SET NULL,
  status paving_qa_run_status NOT NULL DEFAULT 'active',
  setup JSONB NOT NULL DEFAULT '{}',
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  supervisor_final_approved_at TIMESTAMPTZ,
  supervisor_final_approved_by UUID,
  started_by UUID,
  cancelled_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_paving_qa_runs_one_active_per_job
  ON paving_qa_runs (job_id)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_paving_qa_runs_job_id ON paving_qa_runs(job_id);
CREATE INDEX IF NOT EXISTS idx_paving_qa_runs_job_status ON paving_qa_runs(job_id, status);

CREATE TABLE IF NOT EXISTS paving_qa_section_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES paving_qa_runs(id) ON DELETE CASCADE,
  section_code TEXT NOT NULL,
  submission_status paving_qa_submission_status NOT NULL DEFAULT 'draft',
  answers JSONB NOT NULL DEFAULT '{}',
  submitted_at TIMESTAMPTZ,
  submitted_by UUID,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(run_id, section_code)
);

CREATE INDEX IF NOT EXISTS idx_paving_qa_section_submissions_run ON paving_qa_section_submissions(run_id);

CREATE TABLE IF NOT EXISTS paving_qa_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES paving_qa_runs(id) ON DELETE CASCADE,
  section_code TEXT NOT NULL,
  item_key TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  content_type TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  uploaded_by UUID
);

CREATE INDEX IF NOT EXISTS idx_paving_qa_photos_run_section_item
  ON paving_qa_photos(run_id, section_code, item_key);

CREATE TABLE IF NOT EXISTS paving_qa_issues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES paving_qa_runs(id) ON DELETE CASCADE,
  section_code TEXT NOT NULL,
  item_key TEXT NOT NULL,
  severity paving_qa_issue_severity NOT NULL,
  status paving_qa_issue_status NOT NULL DEFAULT 'open',
  title TEXT,
  detail TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_paving_qa_issues_run_status ON paving_qa_issues(run_id, status);
CREATE INDEX IF NOT EXISTS idx_paving_qa_issues_run_section ON paving_qa_issues(run_id, section_code);

CREATE TABLE IF NOT EXISTS paving_qa_supervisor_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES paving_qa_runs(id) ON DELETE CASCADE,
  issue_id UUID REFERENCES paving_qa_issues(id) ON DELETE SET NULL,
  action paving_qa_supervisor_action NOT NULL,
  reason TEXT,
  payload JSONB,
  actor_user_id UUID,
  actor_staff_profile_id UUID,
  actor_display TEXT,
  actor_role TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_paving_qa_supervisor_events_run ON paving_qa_supervisor_events(run_id);
CREATE INDEX IF NOT EXISTS idx_paving_qa_supervisor_events_issue ON paving_qa_supervisor_events(issue_id);

ALTER TABLE public.paving_qa_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.paving_qa_section_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.paving_qa_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.paving_qa_issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.paving_qa_supervisor_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_all_paving_qa_runs" ON public.paving_qa_runs;
CREATE POLICY "service_role_all_paving_qa_runs"
  ON public.paving_qa_runs FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "service_role_all_paving_qa_section_submissions" ON public.paving_qa_section_submissions;
CREATE POLICY "service_role_all_paving_qa_section_submissions"
  ON public.paving_qa_section_submissions FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "service_role_all_paving_qa_photos" ON public.paving_qa_photos;
CREATE POLICY "service_role_all_paving_qa_photos"
  ON public.paving_qa_photos FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "service_role_all_paving_qa_issues" ON public.paving_qa_issues;
CREATE POLICY "service_role_all_paving_qa_issues"
  ON public.paving_qa_issues FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "service_role_all_paving_qa_supervisor_events" ON public.paving_qa_supervisor_events;
CREATE POLICY "service_role_all_paving_qa_supervisor_events"
  ON public.paving_qa_supervisor_events FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
