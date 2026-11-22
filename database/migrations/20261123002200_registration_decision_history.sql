-- Permanent history of registration decisions: which account, which email,
-- what was decided, by whom and when. Recorded by a trigger so every path that
-- moves an account out of Pending (review buttons, context menu, edit form) is
-- captured, including decisions made before this table existed (back-filled
-- from audit_log).
CREATE TABLE registration_decision (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 user_id uuid NOT NULL REFERENCES users(id),
 email text, name text NOT NULL, username text,
 decision text NOT NULL CHECK(decision IN ('approved','disapproved')),
 decided_by uuid REFERENCES users(id),
 decided_by_name text NOT NULL,
 decided_by_email text,
 decided_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX registration_decision_decided_at ON registration_decision(decided_at DESC);
CREATE INDEX registration_decision_user ON registration_decision(user_id);
ALTER TABLE registration_decision ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON registration_decision FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT ON registration_decision TO service_role;

CREATE FUNCTION hope_record_registration_decision() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE actor users; who text:=nullif(current_setting('app.username',true),'');
BEGIN
 IF OLD.status='pending' AND NEW.status IN ('approved','disapproved') THEN
  IF who IS NOT NULL THEN
   SELECT * INTO actor FROM users WHERE id::text=who OR lower(email)=lower(who) OR lower(username)=lower(who) LIMIT 1;
  END IF;
  INSERT INTO registration_decision(user_id,email,name,username,decision,decided_by,decided_by_name,decided_by_email)
  VALUES(NEW.id,NEW.email,NEW.name,NEW.username,NEW.status,actor.id,
   coalesce(nullif(trim(actor.name),''),who,'System'),coalesce(actor.email,CASE WHEN who LIKE '%@%' THEN who END));
 END IF;
 RETURN NULL;
END $$;
CREATE TRIGGER users_registration_decision AFTER UPDATE OF status ON users FOR EACH ROW EXECUTE FUNCTION hope_record_registration_decision();

INSERT INTO registration_decision(user_id,email,name,username,decision,decided_by,decided_by_name,decided_by_email,decided_at)
SELECT u.id,coalesce(a.new_values->>'email',u.email),coalesce(a.new_values->>'name',u.name),coalesce(a.new_values->>'username',u.username),
 a.new_values->>'status',actor.id,coalesce(nullif(trim(actor.name),''),a.action_by),actor.email,a.action_at
FROM audit_log a
JOIN users u ON u.id::text=a.record_key
LEFT JOIN LATERAL (SELECT * FROM users x WHERE x.id::text=a.action_by OR lower(x.email)=lower(a.action_by) OR lower(x.username)=lower(a.action_by) OR x.name=a.action_by ORDER BY x.created_at LIMIT 1) actor ON true
WHERE a.table_name='users' AND a.action='EDIT'
 AND a.old_values->>'status'='pending' AND a.new_values->>'status' IN ('approved','disapproved')
ORDER BY a.action_at;

INSERT INTO app_migration(version) VALUES('202611230022_registration_decision_history');
NOTIFY pgrst,'reload schema';
