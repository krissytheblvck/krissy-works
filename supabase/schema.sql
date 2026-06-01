-- Brilliant Metal Works — Database Schema

-- Clients
create table clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text not null,
  email text,
  company text,
  created_at timestamptz default now()
);

-- Projects
create table projects (
  id uuid primary key default gen_random_uuid(),
  project_code text unique not null,
  client_id uuid references clients(id) on delete cascade,
  type text not null check (type in ('balcony','staircase','railing','gate','facade','ceiling','lighting','custom')),
  status text not null default 'inquiry' check (status in (
    'inquiry','site_survey','concept_design','quotation_sent',
    'approved','fabrication','installation','completed'
  )),
  title text not null,
  location text not null,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Balcony site surveys
create table balcony_surveys (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  total_length numeric not null,
  total_height numeric not null,
  post_spacing numeric not null,
  post_profile text not null,
  bottom_rail_profile text not null,
  top_rail_profile text not null,
  infill_type text not null check (infill_type in ('plain_sheet','glass','flat_bars')),
  sheet_thickness numeric,
  glass_thickness numeric,
  bar_profile text,
  bar_spacing numeric,
  mounting_type text not null check (mounting_type in ('wall','floor')),
  wall_type text,
  access_difficulty text not null default 'easy' check (access_difficulty in ('easy','medium','hard')),
  site_notes text,
  photos text[],
  created_at timestamptz default now()
);

-- Estimations
create table estimations (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  survey_id uuid references balcony_surveys(id) on delete cascade,
  post_count integer not null,
  post_total_length_m numeric not null,
  bottom_rail_length_m numeric not null,
  top_rail_length_m numeric not null,
  infill_area_m2 numeric not null,
  infill_weight_kg numeric not null,
  weld_length_m numeric not null,
  base_plates integer default 0,
  anchor_points integer default 0,
  steel_cost numeric not null,
  infill_cost numeric not null,
  labor_days integer not null,
  labor_cost numeric not null,
  design_cutting_cost numeric default 0,
  installation_cost numeric default 0,
  total_cost numeric not null,
  steel_price_per_kg numeric not null,
  labor_rate_per_day numeric not null,
  created_at timestamptz default now()
);

-- Quotations
create table quotations (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  estimation_id uuid references estimations(id) on delete cascade,
  quote_number text unique not null,
  valid_until date not null,
  scope_of_work text not null,
  payment_terms text not null default '50% deposit, 50% on completion',
  timeline_weeks integer not null,
  status text not null default 'draft' check (status in ('draft','sent','approved','rejected')),
  created_at timestamptz default now()
);

-- Auto-update updated_at on projects
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger projects_updated_at
  before update on projects
  for each row execute function update_updated_at();
