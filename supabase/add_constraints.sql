-- Add unique constraints so upsert works correctly
ALTER TABLE balcony_surveys ADD CONSTRAINT balcony_surveys_project_id_key UNIQUE (project_id);
ALTER TABLE estimations ADD CONSTRAINT estimations_project_id_key UNIQUE (project_id);
ALTER TABLE quotations ADD CONSTRAINT quotations_project_id_key UNIQUE (project_id);
