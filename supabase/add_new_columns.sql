-- Brilliant Metal Works — Migration: new columns for section optimizer
-- Run this in Supabase SQL Editor

-- ── balcony_surveys ──────────────────────────────────────────────────────────
ALTER TABLE balcony_surveys
  ALTER COLUMN post_spacing DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS num_sections   integer,
  ADD COLUMN IF NOT EXISTS catch_profile  text DEFAULT '20x20',
  ADD COLUMN IF NOT EXISTS sheet_width_mm  numeric,
  ADD COLUMN IF NOT EXISTS sheet_height_mm numeric;

-- ── staircase_surveys (create if it doesn't exist, add columns if it does) ──
CREATE TABLE IF NOT EXISTS staircase_surveys (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  total_rise numeric not null,
  total_run numeric not null,
  width numeric not null,
  num_flights integer default 1,
  landing_length numeric,
  handrail_height numeric not null default 1000,
  post_spacing numeric,
  num_sections integer,
  catch_profile text default '20x20',
  rail_sides text not null default 'one' check (rail_sides in ('one','both')),
  post_profile text not null,
  top_rail_profile text not null,
  bottom_rail_profile text not null,
  infill_type text not null check (infill_type in ('plain_sheet','glass','flat_bars')),
  sheet_thickness numeric,
  sheet_width_mm numeric,
  sheet_height_mm numeric,
  glass_thickness numeric,
  bar_spacing numeric,
  access_difficulty text not null default 'easy' check (access_difficulty in ('easy','medium','hard')),
  site_notes text,
  created_at timestamptz default now()
);

-- Add columns if table already exists
ALTER TABLE staircase_surveys
  ADD COLUMN IF NOT EXISTS num_sections   integer,
  ADD COLUMN IF NOT EXISTS catch_profile  text DEFAULT '20x20',
  ADD COLUMN IF NOT EXISTS sheet_width_mm  numeric,
  ADD COLUMN IF NOT EXISTS sheet_height_mm numeric;

-- Upsert constraint (needed by the app's onConflict logic)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'staircase_surveys_project_id_key'
  ) THEN
    ALTER TABLE staircase_surveys
      ADD CONSTRAINT staircase_surveys_project_id_key UNIQUE (project_id);
  END IF;
END$$;

-- Disable RLS for app access (match other tables)
ALTER TABLE staircase_surveys DISABLE ROW LEVEL SECURITY;
