-- migrate:up
ALTER TABLE employee ADD COLUMN archived_at timestamptz;
CREATE FUNCTION hope_create_employee(p_actor uuid,p_data jsonb,p_assignment jsonb DEFAULT NULL) RETURNS jsonb LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
DECLARE actor users; saved jsonb; assignment jsonb;
BEGIN
 SELECT * INTO actor FROM users WHERE id=p_actor AND status='approved' AND NOT is_deleted FOR SHARE;
 IF NOT FOUND OR (actor.role<>'superadmin' AND (coalesce(actor.rights->>'hr.view','false')<>'true' OR coalesce(actor.rights->>'hr.empAdd','false')<>'true')) THEN RAISE EXCEPTION 'Add Employee permission required' USING ERRCODE='42501'; END IF;
 IF p_assignment IS NOT NULL AND actor.role<>'superadmin' AND coalesce(actor.rights->>'hr.jhAdd','false')<>'true' THEN RAISE EXCEPTION 'Add Job History permission required to assign a job' USING ERRCODE='42501'; END IF;
 saved:=hope_insert_auto(p_actor,'employee',p_data,NULL);
 IF p_assignment IS NOT NULL THEN
  IF jsonb_typeof(p_assignment) IS DISTINCT FROM 'object' OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_assignment) k WHERE k NOT IN ('jobcode','deptcode','effdate','salary')) OR nullif(p_assignment->>'jobcode','') IS NULL THEN RAISE EXCEPTION 'Choose a job for this assignment'; END IF;
  assignment:=p_assignment||jsonb_build_object('empno',saved->>'empno','effdate',coalesce(nullif(p_assignment->>'effdate',''),saved->>'hiredate',((clock_timestamp() AT TIME ZONE 'Asia/Manila')::date)::text));
  assignment:=hope_mutate(p_actor,'jobhistory','insert','{}',assignment);
  saved:=saved||jsonb_build_object('job_assignment',assignment);
 END IF;
 RETURN saved;
END $$;
CREATE FUNCTION hope_fire_employee(p_actor uuid,p_empno text,p_expected timestamptz) RETURNS jsonb LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
DECLARE actor users; target employee; today date:=(clock_timestamp() AT TIME ZONE 'Asia/Manila')::date;
BEGIN
 SELECT * INTO actor FROM users WHERE id=p_actor AND status='approved' AND NOT is_deleted FOR SHARE;
 IF NOT FOUND OR actor.role NOT IN ('admin','superadmin') THEN RAISE EXCEPTION 'Administrator required' USING ERRCODE='42501'; END IF;
 IF actor.role<>'superadmin' AND (coalesce(actor.rights->>'hr.view','false')<>'true' OR coalesce(actor.rights->>'hr.empEdit','false')<>'true' OR coalesce(actor.rights->>'hr.empDelete','false')<>'true') THEN RAISE EXCEPTION 'Employee edit and inactivation permissions required' USING ERRCODE='42501'; END IF;
 SELECT * INTO target FROM employee WHERE empno=p_empno FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Employee not found' USING ERRCODE='P0002'; END IF;
 IF p_expected IS NULL OR target.updated_at IS DISTINCT FROM p_expected THEN RAISE EXCEPTION 'Employee changed. Reopen the record before confirming.' USING ERRCODE='40001'; END IF;
 IF target.is_deleted OR target.sepdate IS NOT NULL THEN RAISE EXCEPTION 'Employee is already inactive or separated'; END IF;
 IF target.hiredate>today THEN RAISE EXCEPTION 'Cannot separate an employee before their hire date'; END IF;
 RETURN hope_mutate(p_actor,'employee','update',jsonb_build_object('empno',p_empno),jsonb_build_object('is_deleted',true,'sepdate',today,'archived_at',clock_timestamp()));
END $$;
REVOKE ALL ON FUNCTION hope_create_employee(uuid,jsonb,jsonb),hope_fire_employee(uuid,text,timestamptz) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION hope_create_employee(uuid,jsonb,jsonb),hope_fire_employee(uuid,text,timestamptz) TO service_role;
-- Employee separation preserves historical relationships, including active sales.
CREATE OR REPLACE FUNCTION trg_check_children() RETURNS TRIGGER
LANGUAGE plpgsql AS $$
DECLARE
    v_n INT := 0;
BEGIN
    IF NOT (NEW.is_deleted AND NOT OLD.is_deleted) THEN
        RETURN NEW;                                  -- not a soft delete
    END IF;

    CASE TG_TABLE_NAME
        WHEN 'employee' THEN
            IF NEW.sepdate IS NOT NULL AND NEW.archived_at IS NOT NULL THEN RETURN NEW; END IF;
            SELECT count(*) INTO v_n FROM (
                SELECT 1 FROM jobhistory WHERE empno = OLD.empno AND NOT is_deleted
                UNION ALL
                SELECT 1 FROM sales      WHERE empno = OLD.empno AND NOT is_deleted) c;
        WHEN 'department' THEN
            SELECT count(*) INTO v_n FROM jobhistory
             WHERE deptcode = OLD.deptcode AND NOT is_deleted;
        WHEN 'job' THEN
            SELECT count(*) INTO v_n FROM jobhistory
             WHERE jobcode = OLD.jobcode AND NOT is_deleted;
        WHEN 'customer' THEN
            SELECT count(*) INTO v_n FROM sales
             WHERE custno = OLD.custno AND NOT is_deleted;
        WHEN 'sales' THEN
            SELECT count(*) INTO v_n FROM (
                SELECT 1 FROM salesdetail WHERE transno = OLD.transno AND NOT is_deleted
                UNION ALL
                SELECT 1 FROM payment     WHERE transno = OLD.transno AND NOT is_deleted) c;
        WHEN 'product' THEN
            SELECT count(*) INTO v_n FROM (
                SELECT 1 FROM salesdetail WHERE prodcode = OLD.prodcode AND NOT is_deleted
                UNION ALL
                SELECT 1 FROM pricehist   WHERE prodcode = OLD.prodcode AND NOT is_deleted) c;
        ELSE
            NULL;                                    -- child tables: nothing to check
    END CASE;

    IF v_n > 0 THEN
        RAISE EXCEPTION 'Cannot delete % row: % active related record(s) still exist.', TG_TABLE_NAME, v_n;
    END IF;
    RETURN NEW;
END;
$$;


INSERT INTO app_migration(version) VALUES('202611080010_employee_lifecycle');
NOTIFY pgrst,'reload schema';
-- migrate:down
DO $$ BEGIN RAISE EXCEPTION 'Forward-only migration'; END $$;
