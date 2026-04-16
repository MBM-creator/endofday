-- 20250315100000_stages_checklist_template_id.sql (STEP 13)
ALTER TABLE stages
  ADD COLUMN IF NOT EXISTS checklist_template_id UUID REFERENCES checklist_templates(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_stages_checklist_template_id ON stages(checklist_template_id);
