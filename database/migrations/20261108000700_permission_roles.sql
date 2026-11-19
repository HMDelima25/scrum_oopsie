-- migrate:up
CREATE TABLE permission_role(
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 name text NOT NULL CHECK(length(trim(name)) BETWEEN 1 AND 80 AND lower(trim(name)) NOT IN ('superadmin','admin','user')),
 description text NOT NULL DEFAULT '' CHECK(length(description)<=500),
 rights jsonb NOT NULL DEFAULT '{}' CHECK(jsonb_typeof(rights)='object'),
 status text NOT NULL DEFAULT 'active' CHECK(status IN ('active','inactive')),
 created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX permission_role_name ON permission_role(lower(name));
ALTER TABLE permission_role ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON permission_role FROM PUBLIC,anon,authenticated;
GRANT ALL ON permission_role TO service_role;
ALTER TABLE users ADD COLUMN permission_role_id uuid REFERENCES permission_role(id);
CREATE INDEX users_permission_role ON users(permission_role_id);
CREATE FUNCTION hope_normalize_rights(p_rights jsonb) RETURNS jsonb LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
DECLARE k text; result jsonb:=p_rights;
BEGIN
 IF jsonb_typeof(p_rights) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'Permissions must be an object'; END IF;
 FOR k IN SELECT jsonb_object_keys(p_rights) LOOP
  IF NOT EXISTS(SELECT 1 FROM rights WHERE key=k) OR jsonb_typeof(p_rights->k)<>'boolean' THEN RAISE EXCEPTION 'Unknown permission or non-boolean value: %',k; END IF;
  IF k NOT LIKE '%.view' AND coalesce(p_rights->>(split_part(k,'.',1)||'.view'),'false')<>'true' THEN result:=jsonb_set(result,ARRAY[k],'false'); END IF;
 END LOOP;
 RETURN result;
END $$;
CREATE FUNCTION hope_role_user_rights() RETURNS trigger LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
DECLARE profile permission_role;
BEGIN
 IF NEW.role<>'user' THEN NEW.permission_role_id:=NULL;
 ELSIF NEW.permission_role_id IS NOT NULL THEN
  SELECT * INTO profile FROM permission_role WHERE id=NEW.permission_role_id;
  IF FOUND THEN NEW.rights:=CASE WHEN profile.status='active' THEN profile.rights ELSE '{}'::jsonb END; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER users_ab_permission_role BEFORE INSERT OR UPDATE ON users FOR EACH ROW EXECUTE FUNCTION hope_role_user_rights();
CREATE FUNCTION hope_save_permission_role(p_actor uuid,p_id uuid,p_data jsonb,p_expected timestamptz DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
DECLARE actor users; previous permission_role; saved permission_role; k text; r jsonb;
BEGIN
 SELECT * INTO actor FROM users WHERE id=p_actor AND status='approved' AND NOT is_deleted FOR SHARE;
 IF NOT FOUND OR actor.role NOT IN ('admin','superadmin') THEN RAISE EXCEPTION 'Administrator required' USING ERRCODE='42501'; END IF;
 IF jsonb_typeof(p_data) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'Role data must be an object'; END IF;
 FOR k IN SELECT jsonb_object_keys(p_data) LOOP IF k NOT IN ('name','description','rights','status') THEN RAISE EXCEPTION 'Unsupported role field: %',k; END IF; END LOOP;
 PERFORM set_config('app.username',coalesce(actor.username,actor.email,actor.id::text),true);
 IF p_id IS NOT NULL THEN
  SELECT * INTO previous FROM permission_role WHERE id=p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Role not found' USING ERRCODE='P0002'; END IF;
  IF p_expected IS NOT NULL AND previous.updated_at IS DISTINCT FROM p_expected THEN RAISE EXCEPTION 'Role changed elsewhere; reopen it before saving' USING ERRCODE='40001'; END IF;
 END IF;
 r:=hope_normalize_rights(coalesce(p_data->'rights',previous.rights,'{}'::jsonb));
 IF p_id IS NULL THEN
  INSERT INTO permission_role(name,description,rights,status) VALUES(trim(p_data->>'name'),coalesce(p_data->>'description',''),r,coalesce(p_data->>'status','active')) RETURNING * INTO saved;
 ELSE
  UPDATE permission_role SET name=coalesce(trim(p_data->>'name'),name),description=coalesce(p_data->>'description',description),rights=r,status=coalesce(p_data->>'status',status),updated_at=clock_timestamp() WHERE id=p_id RETURNING * INTO saved;
  UPDATE users SET rights=CASE WHEN saved.status='active' THEN saved.rights ELSE '{}'::jsonb END WHERE permission_role_id=saved.id AND role='user';
 END IF;
 INSERT INTO audit_log(table_name,action,record_key,old_values,new_values,action_by) VALUES('permission_role',CASE WHEN p_id IS NULL THEN 'ADD' ELSE 'EDIT' END,saved.id::text,CASE WHEN p_id IS NOT NULL THEN to_jsonb(previous) ELSE NULL END,to_jsonb(saved),audit_user());
 RETURN to_jsonb(saved);
END $$;
CREATE FUNCTION hope_assign_permission_role(p_actor uuid,p_user uuid,p_role uuid,p_expected timestamptz DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
DECLARE profile permission_role; target users; actor users;
BEGIN
 SELECT * INTO actor FROM users WHERE id=p_actor AND status='approved' AND NOT is_deleted FOR SHARE;
 IF NOT FOUND OR actor.role NOT IN ('admin','superadmin') THEN RAISE EXCEPTION 'Administrator required' USING ERRCODE='42501'; END IF;
 IF p_role IS NOT NULL THEN
  SELECT * INTO profile FROM permission_role WHERE id=p_role FOR SHARE;
  IF NOT FOUND OR profile.status<>'active' THEN RAISE EXCEPTION 'Choose an active permission role'; END IF;
 END IF;
 SELECT * INTO target FROM users WHERE id=p_user FOR UPDATE;
 IF NOT FOUND OR target.is_deleted THEN RAISE EXCEPTION 'User not found' USING ERRCODE='P0002'; END IF;
 IF target.role<>'user' THEN RAISE EXCEPTION 'Named permission roles apply to Users only' USING ERRCODE='42501'; END IF;
 IF p_expected IS NOT NULL AND target.updated_at IS DISTINCT FROM p_expected THEN RAISE EXCEPTION 'User changed elsewhere; reopen before saving' USING ERRCODE='40001'; END IF;
 RETURN hope_mutate(p_actor,'users','update',jsonb_build_object('id',p_user),jsonb_build_object('permission_role_id',p_role,'rights',CASE WHEN p_role IS NULL THEN '{}'::jsonb ELSE profile.rights END));
END $$;
REVOKE ALL ON FUNCTION hope_normalize_rights(jsonb),hope_role_user_rights(),hope_save_permission_role(uuid,uuid,jsonb,timestamptz),hope_assign_permission_role(uuid,uuid,uuid,timestamptz) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION hope_normalize_rights(jsonb),hope_role_user_rights(),hope_save_permission_role(uuid,uuid,jsonb,timestamptz),hope_assign_permission_role(uuid,uuid,uuid,timestamptz) TO service_role;
INSERT INTO app_migration(version) VALUES('202611080007_permission_roles');
NOTIFY pgrst,'reload schema';
-- migrate:down
DO $$ BEGIN RAISE EXCEPTION 'Forward-only permission-role migration'; END $$;
