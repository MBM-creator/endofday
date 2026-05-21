-- 20250313120000_job_pre_commencement_photos.sql
CREATE TABLE IF NOT EXISTS job_pre_commencement_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_job_pre_commencement_photos_job_id ON job_pre_commencement_photos(job_id);

ALTER TABLE public.job_pre_commencement_photos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_all_job_pre_commencement_photos" ON public.job_pre_commencement_photos;
CREATE POLICY "service_role_all_job_pre_commencement_photos"
  ON public.job_pre_commencement_photos FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
