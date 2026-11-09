-- migrate:up
CREATE OR REPLACE FUNCTION audit_user() RETURNS text
LANGUAGE sql STABLE SET search_path=public,pg_temp AS $$
 SELECT coalesce((SELECT nullif(trim(u.name),'') FROM users u WHERE u.username=nullif(current_setting('app.username',true),'') OR u.email=nullif(current_setting('app.username',true),'') OR u.id::text=nullif(current_setting('app.username',true),'') LIMIT 1),nullif(current_setting('app.username',true),''),current_user::text);
$$;
CREATE TABLE login_activity (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL REFERENCES users(id),
 name text NOT NULL,role text NOT NULL CHECK(role IN ('superadmin','admin','user')),
 method text NOT NULL CHECK(method IN ('password','google')),
 logged_in_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX login_activity_latest ON login_activity(logged_in_at DESC,id DESC);
ALTER TABLE login_activity ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON login_activity FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT ON login_activity TO service_role;
CREATE FUNCTION hope_login_activity_immutable() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Login activities are append-only' USING ERRCODE='42501'; END $$;
CREATE TRIGGER login_activity_immutable BEFORE UPDATE OR DELETE ON login_activity FOR EACH ROW EXECUTE FUNCTION hope_login_activity_immutable();
CREATE TRIGGER login_activity_no_truncate BEFORE TRUNCATE ON login_activity FOR EACH STATEMENT EXECUTE FUNCTION hope_login_activity_immutable();
REVOKE ALL ON FUNCTION hope_login_activity_immutable() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION hope_login_activity_immutable() TO service_role;
INSERT INTO app_migration(version) VALUES('202611080017_login_activities_actor_names');
NOTIFY pgrst,'reload schema';
