-- migrate:up
ALTER TABLE users DROP CONSTRAINT users_status_check;
ALTER TABLE users ADD CONSTRAINT users_status_check CHECK(status IN ('pending','approved','disapproved','blocked'));
CREATE FUNCTION hope_review_registration(p_actor uuid,p_user uuid,p_decision text,p_expected timestamptz) RETURNS jsonb
LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
DECLARE account users;
BEGIN
 PERFORM 1 FROM users WHERE id=p_actor AND role='superadmin' AND status='approved' AND NOT is_deleted FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Superadmin approval required' USING ERRCODE='42501'; END IF;
 IF p_decision NOT IN ('approved','disapproved') THEN RAISE EXCEPTION 'Choose Approved or Disapproved'; END IF;
 SELECT * INTO account FROM users WHERE id=p_user AND NOT is_deleted FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'User not found' USING ERRCODE='P0002'; END IF;
 IF account.status<>'pending' THEN RAISE EXCEPTION 'This registration has already been reviewed. Reload its current status.' USING ERRCODE='40001'; END IF;
 IF p_expected IS NULL OR account.updated_at IS DISTINCT FROM p_expected THEN RAISE EXCEPTION 'This account changed elsewhere. Reload before reviewing.' USING ERRCODE='40001'; END IF;
 RETURN hope_mutate(p_actor,'users','update',jsonb_build_object('id',p_user),jsonb_build_object('status',p_decision));
END $$;
REVOKE ALL ON FUNCTION hope_review_registration(uuid,uuid,text,timestamptz) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION hope_review_registration(uuid,uuid,text,timestamptz) TO service_role;
INSERT INTO app_migration(version) VALUES('202611090018_registration_decisions');
NOTIFY pgrst,'reload schema';
