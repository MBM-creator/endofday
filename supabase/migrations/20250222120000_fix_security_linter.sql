-- Fix Supabase Security Advisor issues:
-- 0010: Security Definer View (3 views) -> set security_invoker = on
-- 0013: RLS Disabled in Public (4 tables) -> enable RLS

-- =============================================================================
-- 1. Enable Row Level Security (RLS) on all public tables
-- =============================================================================
-- With RLS enabled, only roles that bypass RLS (e.g. service_role in Supabase)
-- or roles with explicit policies can access data. This app uses the service
-- role key in API routes only, which bypasses RLS. No policies are added here
-- so anon/authenticated get no access by default.

ALTER TABLE public.organisations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_report_photos ENABLE ROW LEVEL SECURITY;

-- (No RLS policies needed for service_role: it bypasses RLS. Anon/authenticated
-- have no policies so they get no access.)

-- =============================================================================
-- 2. Security Definer views -> Security Invoker
-- =============================================================================
-- Views run with the permissions of the user querying them instead of the
-- view owner. Requires PostgreSQL 15+. If ALTER VIEW fails (e.g. older PG),
-- recreate each view with the same definition and omit SECURITY DEFINER.

ALTER VIEW public.daily_reports_reader_v1 SET (security_invoker = on);
ALTER VIEW public.daily_reports_reader_v2 SET (security_invoker = on);
ALTER VIEW public.daily_reports_export_v1 SET (security_invoker = on);
