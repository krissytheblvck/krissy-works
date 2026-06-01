-- Material Prices Table
create table material_prices (
  id uuid primary key default gen_random_uuid(),
  category text not null check (category in ('sheet','profile','cutting','glass','labor')),
  name text not null,
  -- Sheet fields
  thickness_mm numeric,
  width_mm numeric,
  height_mm numeric,
  -- Profile fields
  profile text,
  wall_thickness_mm numeric,
  bar_length_mm numeric default 6000,
  -- Common
  unit text not null,
  price numeric not null,
  is_active boolean default true,
  updated_at timestamptz default now()
);

ALTER TABLE material_prices DISABLE ROW LEVEL SECURITY;

create or replace function update_material_prices_updated_at()
returns trigger as $$
begin new.updated_at = now(); return new; end;
$$ language plpgsql;

create trigger material_prices_updated_at
  before update on material_prices
  for each row execute function update_material_prices_updated_at();

-- Seed default prices
insert into material_prices (category, name, thickness_mm, width_mm, height_mm, unit, price) values
  ('sheet', '1.5mm Sheet 2000×1000', 1.5, 2000, 1000, 'per_sheet', 32000),
  ('sheet', '2mm Sheet 2000×1000',   2.0, 2000, 1000, 'per_sheet', 45000),
  ('sheet', '2mm Sheet 2440×1220',   2.0, 2440, 1220, 'per_sheet', 62000),
  ('sheet', '3mm Sheet 2000×1000',   3.0, 2000, 1000, 'per_sheet', 65000),
  ('sheet', '4mm Sheet 2000×1000',   4.0, 2000, 1000, 'per_sheet', 88000);

insert into material_prices (category, name, profile, wall_thickness_mm, bar_length_mm, unit, price) values
  ('profile', '20×20 SHS', '20x20', 2.0, 6000, 'per_bar', 10000),
  ('profile', '40×20 RHS', '40x20', 2.0, 6000, 'per_bar', 14000),
  ('profile', '40×40 SHS', '40x40', 2.0, 6000, 'per_bar', 18000),
  ('profile', '60×40 RHS', '60x40', 2.0, 6000, 'per_bar', 22000);

insert into material_prices (category, name, thickness_mm, unit, price) values
  ('cutting', 'Laser Cut 1.5mm', 1.5, 'per_sheet', 60000),
  ('cutting', 'Laser Cut 2mm',   2.0, 'per_sheet', 60000),
  ('cutting', 'Laser Cut 3mm',   3.0, 'per_sheet', 75000),
  ('cutting', 'Laser Cut 4mm',   4.0, 'per_sheet', 90000);

insert into material_prices (category, name, thickness_mm, unit, price) values
  ('glass', '8mm Glass',  8,  'per_m2', 65000),
  ('glass', '10mm Glass', 10, 'per_m2', 85000),
  ('glass', '12mm Glass', 12, 'per_m2', 110000);

insert into material_prices (category, name, unit, price) values
  ('labor', 'Fabrication Labor', 'per_day', 15000),
  ('labor', 'Installation Labor', 'per_day', 15000);
