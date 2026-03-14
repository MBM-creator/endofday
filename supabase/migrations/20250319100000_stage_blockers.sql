-- STEP 26: Blocker flag for active stage (one row per stage per calendar day).
CREATE TABLE IF NOT EXISTS stage_blockers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stage_id UUID NOT NULL REFERENCES stages(id) ON DELETE CASCADE,
  report_date DATE NOT NULL,
  blocker_type TEXT NOT NULL,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(stage_id, report_date)
);

CREATE INDEX IF NOT EXISTS idx_stage_blockers_stage_date ON stage_blockers(stage_id, report_date);

ALTER TABLE public.stage_blockers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_all_stage_blockers" ON public.stage_blockers;
CREATE POLICY "service_role_all_stage_blockers"
  ON public.stage_blockers FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
