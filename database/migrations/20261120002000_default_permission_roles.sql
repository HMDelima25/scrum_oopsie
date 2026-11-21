-- Editable starter roles for the permission-role selector.
ALTER TABLE permission_role DROP CONSTRAINT permission_role_name_check;
ALTER TABLE permission_role ADD CONSTRAINT permission_role_name_check
  CHECK(length(trim(name)) BETWEEN 1 AND 80);

INSERT INTO permission_role(name,description,rights)
SELECT 'Admin','All operational permissions. System Admin and Superadmin authority is assigned separately.',jsonb_object_agg(key,true)
FROM rights ON CONFLICT DO NOTHING;

INSERT INTO permission_role(name,description,rights)
SELECT 'Staff','Routine operational access: view, add and edit records without making records inactive.',jsonb_object_agg(key,(lower(key) NOT LIKE '%delete'))
FROM rights ON CONFLICT DO NOTHING;

INSERT INTO permission_role(name,description,rights)
SELECT 'User','Website account access only, with no business-module permissions.',jsonb_object_agg(key,false)
FROM rights ON CONFLICT DO NOTHING;

INSERT INTO app_migration(version) VALUES('202611200020_default_permission_roles');
NOTIFY pgrst,'reload schema';

-- migrate:down
DO $$ BEGIN RAISE EXCEPTION 'Forward-only default permission-role migration'; END $$;
