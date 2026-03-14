-- STEP 13: Allow one checklist template per stage.
ALTER TABLE stages
  ADD COLUMN IF NOT EXISTS checklist_template_id UUID REFERENCES checklist_templates(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_stages_checklist_template_id ON stages(checklist_template_id);
