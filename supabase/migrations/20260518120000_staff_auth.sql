-- Staff authentication profiles (Supabase Auth user id = staff_profiles.id)
-- Deactivate via active = false; do not delete rows.

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE IF NOT EXISTS public.staff_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE RESTRICT,
  org_id UUID NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('field', 'supervisor', 'admin')),
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (org_id, email)
);

CREATE INDEX IF NOT EXISTS idx_staff_profiles_org_id ON public.staff_profiles(org_id);
CREATE INDEX IF NOT EXISTS idx_staff_profiles_email ON public.staff_profiles(email);
CREATE INDEX IF NOT EXISTS idx_staff_profiles_role ON public.staff_profiles(role);
CREATE INDEX IF NOT EXISTS idx_staff_profiles_active ON public.staff_profiles(active);

DROP TRIGGER IF EXISTS staff_profiles_set_updated_at ON public.staff_profiles;
CREATE TRIGGER staff_profiles_set_updated_at
  BEFORE UPDATE ON public.staff_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.staff_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_all_staff_profiles" ON public.staff_profiles;
CREATE POLICY "service_role_all_staff_profiles"
  ON public.staff_profiles FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Wire paving QA audit columns to staff_profiles (nullable for legacy rows)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'paving_qa_section_submissions_submitted_by_fkey'
  ) THEN
    ALTER TABLE public.paving_qa_section_submissions
      ADD CONSTRAINT paving_qa_section_submissions_submitted_by_fkey
      FOREIGN KEY (submitted_by) REFERENCES public.staff_profiles(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'paving_qa_runs_started_by_fkey'
  ) THEN
    ALTER TABLE public.paving_qa_runs
      ADD CONSTRAINT paving_qa_runs_started_by_fkey
      FOREIGN KEY (started_by) REFERENCES public.staff_profiles(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'paving_qa_runs_supervisor_final_approved_by_fkey'
  ) THEN
    ALTER TABLE public.paving_qa_runs
      ADD CONSTRAINT paving_qa_runs_supervisor_final_approved_by_fkey
      FOREIGN KEY (supervisor_final_approved_by) REFERENCES public.staff_profiles(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'paving_qa_photos_uploaded_by_fkey'
  ) THEN
    ALTER TABLE public.paving_qa_photos
      ADD CONSTRAINT paving_qa_photos_uploaded_by_fkey
      FOREIGN KEY (uploaded_by) REFERENCES public.staff_profiles(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'paving_qa_supervisor_events_actor_staff_profile_id_fkey'
  ) THEN
    ALTER TABLE public.paving_qa_supervisor_events
      ADD CONSTRAINT paving_qa_supervisor_events_actor_staff_profile_id_fkey
      FOREIGN KEY (actor_staff_profile_id) REFERENCES public.staff_profiles(id) ON DELETE SET NULL;
  END IF;
END $$;
