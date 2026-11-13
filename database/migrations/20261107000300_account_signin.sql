-- migrate:up
ALTER TABLE users ADD COLUMN username text CHECK(username ~ '^[a-z][a-z0-9._-]{2,31}$');
CREATE UNIQUE INDEX users_username_lower ON users(lower(username)) WHERE username IS NOT NULL;
ALTER TABLE users ALTER COLUMN email DROP NOT NULL;
ALTER TABLE users ADD CONSTRAINT users_login_identifier CHECK(email IS NOT NULL OR username IS NOT NULL);
CREATE TABLE auth_identity (
 provider text NOT NULL CHECK(provider='google'), subject text NOT NULL,
 user_id uuid NOT NULL REFERENCES users(id), created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(provider,subject), UNIQUE(user_id,provider)
);
ALTER TABLE auth_identity ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON auth_identity FROM anon,authenticated;
GRANT SELECT,INSERT,UPDATE,DELETE ON auth_identity TO service_role;
-- Username-only local Admin accounts still produce attributable actor stamps.
DO $$ DECLARE definition text; BEGIN
 SELECT pg_get_functiondef('hope_mutate(uuid,text,text,jsonb,jsonb)'::regprocedure) INTO definition;
 definition=replace(definition,'who.email','coalesce(who.username,who.email,who.id::text)');
 EXECUTE definition;
END $$;
CREATE FUNCTION hope_attach_identity(p_user uuid,p_subject text) RETURNS void
LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
DECLARE account users;
BEGIN
 SELECT * INTO account FROM users WHERE id=p_user AND NOT is_deleted FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Account not found'; END IF;
 INSERT INTO auth_identity(provider,subject,user_id) VALUES('google',p_subject,p_user);
 INSERT INTO audit_log(table_name,action,record_key,new_values,action_by)
 VALUES('auth_identity','ADD',p_user::text,jsonb_build_object('provider','google'),coalesce(account.username,account.email,account.id::text));
END $$;
REVOKE EXECUTE ON FUNCTION hope_attach_identity(uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION hope_attach_identity(uuid,text) TO service_role;
INSERT INTO app_migration(version) VALUES('202611070003_account_signin');
NOTIFY pgrst,'reload schema';
-- migrate:down
DO $$ BEGIN RAISE EXCEPTION 'Forward-only migration; restore a snapshot instead.'; END $$;
