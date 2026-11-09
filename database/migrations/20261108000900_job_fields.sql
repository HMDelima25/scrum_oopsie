-- migrate:up
ALTER TABLE job ADD COLUMN jobname varchar(80),ADD COLUMN jobprefix varchar(3);
DROP VIEW job_active;
ALTER TABLE job ALTER COLUMN jobdesc TYPE varchar(500);
CREATE VIEW job_active WITH (security_invoker=true) AS SELECT * FROM job WHERE NOT is_deleted;
REVOKE ALL ON job_active FROM PUBLIC,anon,authenticated;
GRANT SELECT ON job_active TO service_role;
UPDATE job SET jobname=coalesce(nullif(trim(jobdesc),''),jobcode),jobprefix=coalesce(nullif(left(substring(upper(jobcode) FROM '^[A-Z]+'),3),''),'J');
ALTER TABLE job ALTER COLUMN jobname SET NOT NULL,ALTER COLUMN jobprefix SET NOT NULL;
ALTER TABLE job ADD CONSTRAINT jobname_required CHECK(length(trim(jobname))>0),ADD CONSTRAINT jobprefix_format CHECK(jobprefix ~ '^[A-Z]{1,3}$');
CREATE FUNCTION hope_job_fields() RETURNS trigger LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
BEGIN
 IF TG_OP='INSERT' THEN
  NEW.jobname:=coalesce(NEW.jobname,nullif(trim(NEW.jobdesc),''),NEW.jobcode);
  NEW.jobprefix:=coalesce(upper(trim(NEW.jobprefix)),nullif(left(substring(upper(NEW.jobcode) FROM '^[A-Z]+'),3),''),'J');
 ELSIF NEW.jobprefix IS DISTINCT FROM OLD.jobprefix THEN RAISE EXCEPTION 'Job prefix belongs to its generated code and cannot be changed after creation';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER job_fields BEFORE INSERT OR UPDATE ON job FOR EACH ROW EXECUTE FUNCTION hope_job_fields();
REVOKE ALL ON FUNCTION hope_job_fields() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION hope_job_fields() TO service_role;
INSERT INTO app_migration(version) VALUES('202611080009_job_fields');
NOTIFY pgrst,'reload schema';
-- migrate:down
DO $$ BEGIN RAISE EXCEPTION 'Forward-only migration'; END $$;
