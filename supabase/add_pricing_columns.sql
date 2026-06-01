-- Add per-project pricing settings to estimations table
-- Run this in the Supabase SQL editor

alter table estimations
  add column if not exists consumables_percent    numeric default 7,
  add column if not exists surface_treatment_type text    default 'none',
  add column if not exists surface_treatment_rate numeric default 8000,
  add column if not exists transport_cost         numeric default 0,
  add column if not exists hardware_cost          numeric default 0,
  add column if not exists contingency_percent    numeric default 10,
  add column if not exists margin_percent         numeric default 30;
