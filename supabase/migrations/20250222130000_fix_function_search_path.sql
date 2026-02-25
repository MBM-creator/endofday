-- Fix Supabase Security Advisor: 0011 Function Search Path Mutable
-- Set an explicit search_path and use fully qualified names so the function
-- is not vulnerable to search_path injection.

CREATE OR REPLACE FUNCTION public.generate_site_code_hash(site_code TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  -- digest from pgcrypto (extensions schema in Supabase); encode from pg_catalog
  RETURN pg_catalog.encode(extensions.digest(site_code, 'sha256'), 'hex');
END;
$$;
