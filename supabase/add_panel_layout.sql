-- Add inset panel layout fields to balcony_surveys
alter table balcony_surveys
  add column if not exists panel_layout        text    default 'full_height',
  add column if not exists panel_height_mm     integer,
  add column if not exists panel_gap_top_mm    integer,
  add column if not exists panel_gap_bottom_mm integer;
