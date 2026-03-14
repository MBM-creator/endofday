-- STEP 17: Stage-level checklist completion state (persisted per stage, template unchanged).
CREATE TABLE IF NOT EXISTS stage_checklist_completions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stage_id UUID NOT NULL REFERENCES stages(id) ON DELETE CASCADE,
  checklist_template_item_id UUID NOT NULL REFERENCES checklist_template_items(id) ON DELETE CASCADE,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(stage_id, checklist_template_item_id)
);

CREATE INDEX IF NOT EXISTS idx_stage_checklist_completions_stage_id ON stage_checklist_completions(stage_id);

ALTER TABLE public.stage_checklist_completions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_all_stage_checklist_completions" ON public.stage_checklist_completions;
CREATE POLICY "service_role_all_stage_checklist_completions"
  ON public.stage_checklist_completions FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
