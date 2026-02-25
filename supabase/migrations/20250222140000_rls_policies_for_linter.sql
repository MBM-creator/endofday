-- Fix Supabase Security Advisor: 0008 RLS Enabled No Policy
-- Add explicit policies so each table has at least one policy.
-- This app only uses the service_role key (server-side API), which bypasses RLS;
-- these policies document intent and satisfy the linter. Anon/authenticated
-- still have no policies, so they get no access.

CREATE POLICY "service_role_all_organisations"
  ON public.organisations FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "service_role_all_sites"
  ON public.sites FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "service_role_all_daily_reports"
  ON public.daily_reports FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "service_role_all_daily_report_photos"
  ON public.daily_report_photos FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
