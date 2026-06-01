-- Migration: glass_system_type, bar_profile, and quoted_price
-- Run this in the Supabase SQL editor

-- glass_system_type on balcony surveys
ALTER TABLE balcony_surveys
  ADD COLUMN IF NOT EXISTS glass_system_type text;

-- glass_system_type + bar_profile on staircase surveys
ALTER TABLE staircase_surveys
  ADD COLUMN IF NOT EXISTS glass_system_type text,
  ADD COLUMN IF NOT EXISTS bar_profile        text DEFAULT '40x20';

-- quoted_price on estimations (full client-facing price incl. margin & contingency)
ALTER TABLE estimations
  ADD COLUMN IF NOT EXISTS quoted_price numeric DEFAULT 0;
