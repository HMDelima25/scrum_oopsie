-- migrate:up
CREATE FUNCTION hope_hr_record_members(p_actor uuid,p_kind text,p_code text) RETURNS jsonb LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
DECLARE actor users; parent_active boolean; result jsonb; today date:=(clock_timestamp() AT TIME ZONE 'Asia/Manila')::date;
BEGIN
 SELECT * INTO actor FROM users WHERE id=p_actor AND status='approved' AND NOT is_deleted FOR SHARE;
 IF NOT FOUND OR (actor.role<>'superadmin' AND coalesce(actor.rights->>'hr.view','false')<>'true') THEN RAISE EXCEPTION 'Human Resources access required' USING ERRCODE='42501'; END IF;
 IF p_kind='departments' THEN SELECT NOT is_deleted INTO parent_active FROM department WHERE deptcode=p_code;
 ELSIF p_kind='jobs' THEN SELECT NOT is_deleted INTO parent_active FROM job WHERE jobcode=p_code;
 ELSE RAISE EXCEPTION 'Unknown Human Resources record'; END IF;
 IF parent_active IS NULL THEN RAISE EXCEPTION 'Record not found' USING ERRCODE='P0002'; END IF;
 IF NOT parent_active THEN RETURN jsonb_build_object('jobs','[]'::jsonb,'employees','[]'::jsonb,'departments','[]'::jsonb); END IF;
 WITH current_members AS (
  SELECT e.empno,e.lastname,e.firstname,e.gender,e.jobcode,e.jobname,e.deptcode,e.deptname
  FROM employee_directory e
  JOIN job j ON j.jobcode=e.jobcode AND NOT j.is_deleted
  WHERE NOT e.is_deleted AND e.hiredate<=today AND (e.sepdate IS NULL OR e.sepdate>today)
  AND (e.deptcode IS NULL OR EXISTS(SELECT 1 FROM department d WHERE d.deptcode=e.deptcode AND NOT d.is_deleted))
  AND ((p_kind='departments' AND e.deptcode=p_code) OR (p_kind='jobs' AND e.jobcode=p_code))
 ) SELECT jsonb_build_object(
  'employees',(SELECT coalesce(jsonb_agg(jsonb_build_object('empno',empno,'lastname',lastname,'firstname',firstname,'gender',gender) ORDER BY lastname,firstname,empno),'[]'::jsonb) FROM current_members),
  'jobs',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.jobcode),'[]'::jsonb) FROM (SELECT DISTINCT jobcode,jobname FROM current_members) x),
  'departments',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.deptname,x.deptcode),'[]'::jsonb) FROM (SELECT DISTINCT deptcode,deptname FROM current_members WHERE deptcode IS NOT NULL) x)
 ) INTO result;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION hope_hr_record_members(uuid,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION hope_hr_record_members(uuid,text,text) TO service_role;
INSERT INTO app_migration(version) VALUES('202611080013_hr_record_members');
NOTIFY pgrst,'reload schema';
-- migrate:down
DO $$ BEGIN RAISE EXCEPTION 'Forward-only migration'; END $$;
