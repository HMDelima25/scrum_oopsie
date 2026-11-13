-- migrate:up
ALTER TABLE user_token ADD COLUMN code_hash text, ADD COLUMN code_attempts integer NOT NULL DEFAULT 0;
CREATE FUNCTION hope_issue_recovery(p_user uuid,p_id uuid,p_code_hash text,p_token_hash text) RETURNS boolean
LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
BEGIN
 PERFORM 1 FROM users WHERE id=p_user AND NOT is_deleted FOR UPDATE;
 IF NOT FOUND THEN RETURN false; END IF;
 IF EXISTS(SELECT 1 FROM user_token WHERE user_id=p_user AND code_hash IS NOT NULL AND created_at>now()-interval '60 seconds') THEN RETURN false; END IF;
 UPDATE user_token SET used_at=now() WHERE user_id=p_user AND purpose='reset' AND used_at IS NULL;
 INSERT INTO user_token(id,user_id,token_hash,purpose,expires_at,code_hash) VALUES(p_id,p_user,p_token_hash,'reset',now()+interval '10 minutes',p_code_hash);
 RETURN true;
END $$;
CREATE FUNCTION hope_verify_recovery(p_id uuid,p_code_hash text,p_grant_hash text) RETURNS boolean
LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
DECLARE r user_token;
BEGIN
 SELECT * INTO r FROM user_token WHERE id=p_id FOR UPDATE;
 IF NOT FOUND OR r.used_at IS NOT NULL OR r.expires_at<=now() OR r.code_hash IS NULL OR r.code_attempts>=5 THEN RETURN false; END IF;
 UPDATE user_token SET code_attempts=code_attempts+1 WHERE id=p_id;
 IF r.code_hash<>p_code_hash THEN RETURN false; END IF;
 UPDATE user_token SET code_hash=NULL,token_hash=p_grant_hash,expires_at=now()+interval '10 minutes' WHERE id=p_id;
 RETURN true;
END $$;
REVOKE ALL ON FUNCTION hope_issue_recovery(uuid,uuid,text,text),hope_verify_recovery(uuid,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION hope_issue_recovery(uuid,uuid,text,text),hope_verify_recovery(uuid,text,text) TO service_role;
INSERT INTO app_migration(version) VALUES('202611080016_email_recovery_codes');
NOTIFY pgrst,'reload schema';
