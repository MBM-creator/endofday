-- 20250222130000_fix_function_search_path.sql
CREATE OR REPLACE FUNCTION public.generate_site_code_hash(site_code TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  RETURN pg_catalog.encode(extensions.digest(site_code, 'sha256'), 'hex');
END;
$$;
