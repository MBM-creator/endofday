-- STEP 28: Stage labour tracking (one row per stage per calendar day).
CREATE TABLE IF NOT EXISTS stage_labour (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stage_id UUID NOT NULL REFERENCES stages(id) ON DELETE CASCADE,
  report_date DATE NOT NULL,
  crew_count INTEGER NOT NULL,
  hours_worked NUMERIC NOT NULL,
  labour_hours NUMERIC NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(stage_id, report_date)
);

CREATE INDEX IF NOT EXISTS idx_stage_labour_stage_date ON stage_labour(stage_id, report_date);

ALTER TABLE public.stage_labour ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_all_stage_labour" ON public.stage_labour;
CREATE POLICY "service_role_all_stage_labour"
  ON public.stage_labour FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
