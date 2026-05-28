-- Job activity notes and video attachments.

CREATE TABLE IF NOT EXISTS public.job_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  stage_id UUID REFERENCES public.stages(id) ON DELETE SET NULL,
  author_staff_profile_id UUID REFERENCES public.staff_profiles(id) ON DELETE SET NULL,
  body TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_job_notes_job_created
  ON public.job_notes(job_id, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_job_notes_stage_id
  ON public.job_notes(stage_id)
  WHERE stage_id IS NOT NULL AND deleted_at IS NULL;

DROP TRIGGER IF EXISTS job_notes_set_updated_at ON public.job_notes;
CREATE TRIGGER job_notes_set_updated_at
  BEFORE UPDATE ON public.job_notes
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.job_note_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  note_id UUID NOT NULL REFERENCES public.job_notes(id) ON DELETE CASCADE,
  job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  media_type TEXT NOT NULL CHECK (media_type IN ('video')),
  mime_type TEXT NOT NULL,
  file_name TEXT,
  file_size_bytes BIGINT NOT NULL CHECK (file_size_bytes > 0),
  duration_seconds NUMERIC,
  uploaded_by UUID REFERENCES public.staff_profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  UNIQUE(storage_path)
);

CREATE INDEX IF NOT EXISTS idx_job_note_attachments_note_id
  ON public.job_note_attachments(note_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_job_note_attachments_job_created
  ON public.job_note_attachments(job_id, created_at DESC)
  WHERE deleted_at IS NULL;

ALTER TABLE public.job_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_note_attachments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_all_job_notes" ON public.job_notes;
CREATE POLICY "service_role_all_job_notes"
  ON public.job_notes FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "service_role_all_job_note_attachments" ON public.job_note_attachments;
CREATE POLICY "service_role_all_job_note_attachments"
  ON public.job_note_attachments FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Browser TUS uploads use the signed-in staff member's Supabase Auth token.
-- The app API still controls which uploaded object is recorded and displayed.
DROP POLICY IF EXISTS "authenticated_insert_job_note_video_objects" ON storage.objects;
CREATE POLICY "authenticated_insert_job_note_video_objects"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'daily-reports'
    AND name LIKE 'jobs/%/notes/%/videos/%'
  );

DROP POLICY IF EXISTS "authenticated_update_job_note_video_objects" ON storage.objects;
CREATE POLICY "authenticated_update_job_note_video_objects"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'daily-reports'
    AND name LIKE 'jobs/%/notes/%/videos/%'
  )
  WITH CHECK (
    bucket_id = 'daily-reports'
    AND name LIKE 'jobs/%/notes/%/videos/%'
  );
