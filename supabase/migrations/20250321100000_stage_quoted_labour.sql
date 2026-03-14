-- STEP 31: Quoted labour hours per stage.
ALTER TABLE stages
  ADD COLUMN IF NOT EXISTS quoted_labour_hours NUMERIC;
