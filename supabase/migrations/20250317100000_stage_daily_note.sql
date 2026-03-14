-- STEP 18: Stage-level daily note (one persistent note per stage for Today's Work).
ALTER TABLE stages
  ADD COLUMN IF NOT EXISTS daily_note TEXT,
  ADD COLUMN IF NOT EXISTS daily_note_updated_at TIMESTAMPTZ DEFAULT now();
