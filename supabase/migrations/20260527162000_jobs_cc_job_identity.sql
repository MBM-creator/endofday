ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS cc_quote_id UUID,
  ADD COLUMN IF NOT EXISTS cc_job_id TEXT,
  ADD COLUMN IF NOT EXISTS cc_job_number TEXT;

WITH ranked AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY organisation_id, cc_project_id
      ORDER BY created_at ASC NULLS LAST, id ASC
    ) AS rn
  FROM public.jobs
  WHERE cc_project_id IS NOT NULL
)
UPDATE public.jobs j
SET cc_project_id = NULL
FROM ranked r
WHERE j.id = r.id
  AND r.rn > 1;

WITH ranked AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY organisation_id, cc_quote_id
      ORDER BY created_at ASC NULLS LAST, id ASC
    ) AS rn
  FROM public.jobs
  WHERE cc_quote_id IS NOT NULL
)
UPDATE public.jobs j
SET cc_quote_id = NULL
FROM ranked r
WHERE j.id = r.id
  AND r.rn > 1;

WITH ranked AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY organisation_id, cc_job_id
      ORDER BY created_at ASC NULLS LAST, id ASC
    ) AS rn
  FROM public.jobs
  WHERE cc_job_id IS NOT NULL
)
UPDATE public.jobs j
SET cc_job_id = NULL
FROM ranked r
WHERE j.id = r.id
  AND r.rn > 1;

WITH ranked AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY organisation_id, cc_job_number
      ORDER BY created_at ASC NULLS LAST, id ASC
    ) AS rn
  FROM public.jobs
  WHERE cc_job_number IS NOT NULL
)
UPDATE public.jobs j
SET cc_job_number = NULL
FROM ranked r
WHERE j.id = r.id
  AND r.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS idx_jobs_org_cc_project_id_unique
  ON public.jobs(organisation_id, cc_project_id)
  WHERE cc_project_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_jobs_org_cc_quote_id_unique
  ON public.jobs(organisation_id, cc_quote_id)
  WHERE cc_quote_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_jobs_org_cc_job_id_unique
  ON public.jobs(organisation_id, cc_job_id)
  WHERE cc_job_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_jobs_org_cc_job_number_unique
  ON public.jobs(organisation_id, cc_job_number)
  WHERE cc_job_number IS NOT NULL;
