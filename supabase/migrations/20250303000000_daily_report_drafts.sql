-- Draft table for draft-first report flow (per-image upload).
-- Drafts hold no report row until submit; storage uses prefix drafts/{draftId}/.

CREATE TABLE IF NOT EXISTS daily_report_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_daily_report_drafts_organisation_id ON daily_report_drafts(organisation_id);
CREATE INDEX IF NOT EXISTS idx_daily_report_drafts_created_at ON daily_report_drafts(created_at);

ALTER TABLE public.daily_report_drafts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all_daily_report_drafts"
  ON public.daily_report_drafts FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
