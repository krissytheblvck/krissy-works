-- Migration: custom section option fields for "Try Your Own Layout"
-- Run this in the Supabase SQL editor

ALTER TABLE balcony_surveys
  ADD COLUMN IF NOT EXISTS custom_sections          integer,
  ADD COLUMN IF NOT EXISTS custom_section_width_mm   numeric,
  ADD COLUMN IF NOT EXISTS custom_cut_width_mm       numeric,
  ADD COLUMN IF NOT EXISTS custom_cut_height_mm      numeric;

ALTER TABLE staircase_surveys
  ADD COLUMN IF NOT EXISTS custom_sections          integer,
  ADD COLUMN IF NOT EXISTS custom_section_width_mm   numeric,
  ADD COLUMN IF NOT EXISTS custom_cut_width_mm       numeric,
  ADD COLUMN IF NOT EXISTS custom_cut_height_mm      numeric;
