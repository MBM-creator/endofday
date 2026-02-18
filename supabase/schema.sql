-- Daily Reports Database Schema
-- Run this in your Supabase SQL editor

-- Organisations table
CREATE TABLE IF NOT EXISTS organisations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Sites table
CREATE TABLE IF NOT EXISTS sites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  site_number TEXT NOT NULL,
  site_code_hash TEXT NOT NULL,
  site_name TEXT,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(organisation_id, site_number)
);

-- Daily reports table
CREATE TABLE IF NOT EXISTS daily_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  submitted_at TIMESTAMPTZ DEFAULT NOW(),
  summary TEXT NOT NULL,
  finished_plan BOOLEAN NOT NULL,
  not_finished_why TEXT,
  catchup_plan TEXT,
  site_left_clean_notes TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Daily report photos table
CREATE TABLE IF NOT EXISTS daily_report_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL REFERENCES daily_reports(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_sites_organisation_id ON sites(organisation_id);
CREATE INDEX IF NOT EXISTS idx_sites_organisation_site_number ON sites(organisation_id, site_number);
CREATE INDEX IF NOT EXISTS idx_sites_active ON sites(active) WHERE active = TRUE;
CREATE INDEX IF NOT EXISTS idx_daily_reports_organisation_id ON daily_reports(organisation_id);
CREATE INDEX IF NOT EXISTS idx_daily_reports_site_id ON daily_reports(site_id);
CREATE INDEX IF NOT EXISTS idx_daily_reports_submitted_at ON daily_reports(submitted_at);
CREATE INDEX IF NOT EXISTS idx_daily_report_photos_report_id ON daily_report_photos(report_id);

-- Function to generate site_code_hash (if you need it)
-- This creates a hash from site_number for lookup/security purposes
CREATE OR REPLACE FUNCTION generate_site_code_hash(site_code TEXT)
RETURNS TEXT AS $$
BEGIN
  RETURN encode(digest(site_code, 'sha256'), 'hex');
END;
$$ LANGUAGE plpgsql;
