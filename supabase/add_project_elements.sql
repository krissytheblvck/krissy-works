-- Project Elements: enables multiple element types within a single project

create table project_elements (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  type text not null check (type in ('balcony','staircase','railing','gate','facade','ceiling','lighting','custom')),
  name text not null,
  display_order int not null default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index idx_project_elements_project_id on project_elements(project_id);

-- Add element_id to existing survey/estimation/quotation tables
alter table balcony_surveys add column element_id uuid references project_elements(id) on delete cascade;
alter table staircase_surveys add column element_id uuid references project_elements(id) on delete cascade;
alter table estimations add column element_id uuid references project_elements(id) on delete cascade;
alter table quotations add column element_id uuid references project_elements(id) on delete cascade;

-- Migrate existing projects: create one element per project based on its type
insert into project_elements (project_id, type, name, display_order)
select
  p.id,
  p.type,
  p.title,
  0
from projects p
where not exists (
  select 1 from project_elements pe where pe.project_id = p.id
);

-- Link existing balcony_surveys to their element
update balcony_surveys bs
set element_id = pe.id
from project_elements pe
where pe.project_id = bs.project_id
  and pe.type = 'balcony'
  and bs.element_id is null;

-- Link existing staircase_surveys to their element
update staircase_surveys ss
set element_id = pe.id
from project_elements pe
where pe.project_id = ss.project_id
  and pe.type = 'staircase'
  and ss.element_id is null;

-- Link existing estimations via their survey's element
update estimations e
set element_id = bs.element_id
from balcony_surveys bs
where e.survey_id = bs.id
  and bs.element_id is not null
  and e.element_id is null;

update estimations e
set element_id = ss.element_id
from staircase_surveys ss
where e.survey_id = ss.id
  and ss.element_id is not null
  and e.element_id is null;

-- Link existing quotations via their estimation's element
update quotations q
set element_id = e.element_id
from estimations e
where q.estimation_id = e.id
  and e.element_id is not null
  and q.element_id is null;
