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

-- Link existing balcony_surveys to their project's first element
update balcony_surveys bs
set element_id = (
  select pe.id from project_elements pe
  where pe.project_id = bs.project_id
  order by pe.display_order, pe.created_at
  limit 1
)
where bs.element_id is null;

-- Link existing staircase_surveys to their project's first element
update staircase_surveys ss
set element_id = (
  select pe.id from project_elements pe
  where pe.project_id = ss.project_id
  order by pe.display_order, pe.created_at
  limit 1
)
where ss.element_id is null;

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
