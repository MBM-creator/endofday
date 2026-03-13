-- STEP 6: Pre-commencement photo metadata for jobs.
-- Storage path convention: jobs/{job_id}/pre-commencement/{filename} in existing bucket.

CREATE TABLE IF NOT EXISTS job_pre_commencement_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_job_pre_commencement_photos_job_id ON job_pre_commencement_photos(job_id);

ALTER TABLE public.job_pre_commencement_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all_job_pre_commencement_photos"
  ON public.job_pre_commencement_photos FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
