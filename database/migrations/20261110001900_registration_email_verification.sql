CREATE TABLE registration_challenge (
 id uuid PRIMARY KEY, email text UNIQUE NOT NULL, name text NOT NULL, username text,
 password_hash text, code_hash text, attempts integer NOT NULL DEFAULT 0,
 created_at timestamptz NOT NULL DEFAULT now(), expires_at timestamptz NOT NULL DEFAULT now()+interval '10 minutes', used_at timestamptz
);
ALTER TABLE registration_challenge ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON registration_challenge FROM PUBLIC,anon,authenticated;
GRANT ALL ON registration_challenge TO service_role;
CREATE FUNCTION hope_stage_registration(p_id uuid,p_email text,p_name text,p_username text,p_password text,p_code text) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended(p_email,0));
 IF EXISTS(SELECT 1 FROM users WHERE lower(email)=p_email OR (p_username IS NOT NULL AND lower(username)=p_username)) THEN RAISE EXCEPTION 'Email or username already exists.' USING ERRCODE='23505'; END IF;
 IF EXISTS(SELECT 1 FROM registration_challenge WHERE email=p_email AND created_at>now()-interval '60 seconds') THEN RETURN false; END IF;
 DELETE FROM registration_challenge WHERE email=p_email OR expires_at<now()-interval '1 day';
 INSERT INTO registration_challenge(id,email,name,username,password_hash,code_hash) VALUES(p_id,p_email,p_name,p_username,p_password,p_code);
 RETURN true;
END $$;
CREATE FUNCTION hope_confirm_registration(p_id uuid,p_code text) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE c registration_challenge; u users;
BEGIN
 SELECT * INTO c FROM registration_challenge WHERE id=p_id FOR UPDATE;
 IF NOT FOUND OR c.used_at IS NOT NULL OR c.expires_at<=now() OR c.attempts>=5 THEN RETURN NULL; END IF;
 UPDATE registration_challenge SET attempts=attempts+1 WHERE id=p_id;
 IF c.code_hash<>p_code THEN RETURN NULL; END IF;
 INSERT INTO users(email,name,username,password_hash,role,status) VALUES(c.email,c.name,c.username,c.password_hash,'user','pending') RETURNING * INTO u;
 UPDATE registration_challenge SET used_at=now(),password_hash=NULL,code_hash=NULL WHERE id=p_id;
 RETURN jsonb_build_object('id',u.id,'email',u.email,'name',u.name,'username',u.username,'role',u.role,'status',u.status);
END $$;
REVOKE ALL ON FUNCTION hope_stage_registration(uuid,text,text,text,text,text),hope_confirm_registration(uuid,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION hope_stage_registration(uuid,text,text,text,text,text),hope_confirm_registration(uuid,text) TO service_role;
INSERT INTO app_migration(version) VALUES('202611100019_registration_email_verification');
NOTIFY pgrst,'reload schema';
