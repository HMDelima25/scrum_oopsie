-- A disapproved registration releases its email: the owner may register again.
-- Blocked, pending, approved and inactive accounts keep their email reserved.
-- Re-registering resets the same users row to a pending User account so audit
-- history and earlier references stay attached to one record.
CREATE OR REPLACE FUNCTION hope_stage_registration(p_id uuid,p_email text,p_name text,p_username text,p_password text,p_code text) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended(p_email,0));
 IF EXISTS(SELECT 1 FROM users
   WHERE (lower(email)=p_email OR (p_username IS NOT NULL AND lower(username)=p_username))
   AND NOT (lower(email)=p_email AND status='disapproved' AND NOT is_deleted))
 THEN RAISE EXCEPTION 'Email or username already exists.' USING ERRCODE='23505'; END IF;
 IF EXISTS(SELECT 1 FROM registration_challenge WHERE email=p_email AND created_at>now()-interval '60 seconds') THEN RETURN false; END IF;
 DELETE FROM registration_challenge WHERE email=p_email OR expires_at<now()-interval '1 day';
 INSERT INTO registration_challenge(id,email,name,username,password_hash,code_hash) VALUES(p_id,p_email,p_name,p_username,p_password,p_code);
 RETURN true;
END $$;

CREATE OR REPLACE FUNCTION hope_confirm_registration(p_id uuid,p_code text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE c registration_challenge; u users;
BEGIN
 SELECT * INTO c FROM registration_challenge WHERE id=p_id FOR UPDATE;
 IF NOT FOUND OR c.used_at IS NOT NULL OR c.expires_at<=now() OR c.attempts>=5 THEN RETURN NULL; END IF;
 UPDATE registration_challenge SET attempts=attempts+1 WHERE id=p_id;
 IF c.code_hash<>p_code THEN RETURN NULL; END IF;
 SELECT * INTO u FROM users WHERE lower(email)=c.email FOR UPDATE;
 IF FOUND THEN
  -- Re-checked here: an administrator may have blocked the account after the code was sent.
  IF u.status<>'disapproved' OR u.is_deleted THEN RAISE EXCEPTION 'Email or username already exists.' USING ERRCODE='23505'; END IF;
  UPDATE users SET name=c.name,username=c.username,password_hash=c.password_hash,role='user',status='pending',
   permission_role_id=NULL,rights='{}',reset_token=NULL,reset_token_expires=NULL
  WHERE id=u.id RETURNING * INTO u;
  UPDATE user_token SET used_at=now() WHERE user_id=u.id AND used_at IS NULL;
 ELSE
  INSERT INTO users(email,name,username,password_hash,role,status) VALUES(c.email,c.name,c.username,c.password_hash,'user','pending') RETURNING * INTO u;
 END IF;
 UPDATE registration_challenge SET used_at=now(),password_hash=NULL,code_hash=NULL WHERE id=p_id;
 RETURN jsonb_build_object('id',u.id,'email',u.email,'name',u.name,'username',u.username,'role',u.role,'status',u.status);
END $$;

REVOKE ALL ON FUNCTION hope_stage_registration(uuid,text,text,text,text,text),hope_confirm_registration(uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION hope_stage_registration(uuid,text,text,text,text,text),hope_confirm_registration(uuid,text) TO service_role;
INSERT INTO app_migration(version) VALUES('202611230021_reuse_disapproved_registration_email');
NOTIFY pgrst,'reload schema';
