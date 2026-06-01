-- Allow multiple balcony areas (surveys + estimations) per project
alter table balcony_surveys drop constraint if exists balcony_surveys_project_id_key;
alter table estimations     drop constraint if exists estimations_project_id_key;

-- Area name so each survey row is identifiable
alter table balcony_surveys add column if not exists name text not null default 'Main Area';
