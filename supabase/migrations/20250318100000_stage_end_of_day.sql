-- STEP 19: Stage end-of-day submission (one row per stage per calendar day).
CREATE TABLE IF NOT EXISTS stage_end_of_day (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stage_id UUID NOT NULL REFERENCES stages(id) ON DELETE CASCADE,
  report_date DATE NOT NULL,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  summary TEXT,
  UNIQUE(stage_id, report_date)
);

CREATE INDEX IF NOT EXISTS idx_stage_end_of_day_stage_date ON stage_end_of_day(stage_id, report_date);

ALTER TABLE public.stage_end_of_day ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_all_stage_end_of_day" ON public.stage_end_of_day;
CREATE POLICY "service_role_all_stage_end_of_day"
  ON public.stage_end_of_day FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
