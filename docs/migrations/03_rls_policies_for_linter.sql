-- 20250222140000_rls_policies_for_linter.sql (idempotent: safe to re-run)
DROP POLICY IF EXISTS "service_role_all_organisations" ON public.organisations;
CREATE POLICY "service_role_all_organisations"
  ON public.organisations FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "service_role_all_sites" ON public.sites;
CREATE POLICY "service_role_all_sites"
  ON public.sites FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "service_role_all_daily_reports" ON public.daily_reports;
CREATE POLICY "service_role_all_daily_reports"
  ON public.daily_reports FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "service_role_all_daily_report_photos" ON public.daily_report_photos;
CREATE POLICY "service_role_all_daily_report_photos"
  ON public.daily_report_photos FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
