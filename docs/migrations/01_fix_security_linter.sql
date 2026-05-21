-- 20250222120000_fix_security_linter.sql
ALTER TABLE public.organisations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_report_photos ENABLE ROW LEVEL SECURITY;

ALTER VIEW public.daily_reports_reader_v1 SET (security_invoker = on);
ALTER VIEW public.daily_reports_reader_v2 SET (security_invoker = on);
ALTER VIEW public.daily_reports_export_v1 SET (security_invoker = on);
