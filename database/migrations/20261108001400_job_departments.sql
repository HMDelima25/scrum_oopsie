-- migrate:up
ALTER TABLE job ADD COLUMN deptcode varchar(3) REFERENCES department(deptcode);
-- Infer a home only where existing current assignments identify one department.
UPDATE job j SET deptcode=x.deptcode FROM (
 SELECT jobcode,min(deptcode) deptcode FROM employee_directory
 WHERE NOT is_deleted AND hiredate<=(clock_timestamp() AT TIME ZONE 'Asia/Manila')::date
 AND (sepdate IS NULL OR sepdate>(clock_timestamp() AT TIME ZONE 'Asia/Manila')::date)
 AND deptcode IS NOT NULL GROUP BY jobcode HAVING count(DISTINCT deptcode)=1
) x WHERE j.jobcode=x.jobcode;
CREATE VIEW job_directory WITH (security_invoker=true) AS SELECT j.*,d.deptname FROM job j LEFT JOIN department d USING(deptcode);
REVOKE ALL ON job_directory FROM PUBLIC,anon,authenticated;
GRANT SELECT ON job_directory TO service_role;
CREATE FUNCTION hope_department_job_prefix(p_deptcode text) RETURNS text LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
DECLARE code text; prefix text;
BEGIN
 SELECT deptcode INTO code FROM department WHERE deptcode=p_deptcode AND NOT is_deleted FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Choose an existing active department'; END IF;
 prefix:=substring(upper(code) FROM '^[A-Z]+');
 IF prefix IS NULL OR length(prefix)>3 THEN RAISE EXCEPTION 'Department code cannot generate a job code'; END IF;
 RETURN prefix;
END $$;
CREATE OR REPLACE FUNCTION hope_job_fields() RETURNS trigger LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
BEGIN
 IF TG_OP='INSERT' THEN
  NEW.jobname:=coalesce(NEW.jobname,nullif(trim(NEW.jobdesc),''),NEW.jobcode);
  IF NEW.deptcode IS NOT NULL AND NOT NEW.is_deleted THEN NEW.jobprefix:=hope_department_job_prefix(NEW.deptcode); END IF;
  NEW.jobprefix:=coalesce(upper(trim(NEW.jobprefix)),nullif(left(substring(upper(NEW.jobcode) FROM '^[A-Z]+'),3),''),'J');
 ELSE
  IF NEW.jobprefix IS DISTINCT FROM OLD.jobprefix THEN RAISE EXCEPTION 'Generated job prefix cannot be changed'; END IF;
  IF NOT NEW.is_deleted AND NEW.deptcode IS NOT NULL AND (NEW.deptcode IS DISTINCT FROM OLD.deptcode OR OLD.is_deleted) THEN PERFORM hope_department_job_prefix(NEW.deptcode); END IF;
  IF OLD.deptcode IS NOT NULL AND NEW.deptcode IS NULL THEN RAISE EXCEPTION 'Choose an existing active department'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE FUNCTION hope_create_department_job(p_actor uuid,p_data jsonb) RETURNS jsonb LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
DECLARE actor users; prefix text;
BEGIN
 SELECT * INTO actor FROM users WHERE id=p_actor AND status='approved' AND NOT is_deleted FOR SHARE;
 IF NOT FOUND OR (actor.role<>'superadmin' AND (coalesce(actor.rights->>'hr.view','false')<>'true' OR coalesce(actor.rights->>'hr.jobAdd','false')<>'true')) THEN RAISE EXCEPTION 'Add Job permission required' USING ERRCODE='42501'; END IF;
 IF jsonb_typeof(p_data) IS DISTINCT FROM 'object' OR EXISTS(SELECT 1 FROM jsonb_object_keys(p_data) k WHERE k NOT IN ('jobname','jobdesc','deptcode')) THEN RAISE EXCEPTION 'Unsupported job field'; END IF;
 IF nullif(trim(p_data->>'jobname'),'') IS NULL OR nullif(trim(p_data->>'jobdesc'),'') IS NULL THEN RAISE EXCEPTION 'Job name and description are required'; END IF;
 prefix:=hope_department_job_prefix(p_data->>'deptcode');
 RETURN hope_insert_auto(p_actor,'job',p_data||jsonb_build_object('jobprefix',prefix),prefix);
END $$;
REVOKE ALL ON FUNCTION hope_department_job_prefix(text),hope_create_department_job(uuid,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION hope_department_job_prefix(text),hope_create_department_job(uuid,jsonb) TO service_role;

CREATE OR REPLACE FUNCTION hope_inactivation_plan(p_actor uuid,p_table text,p_key jsonb) RETURNS jsonb LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
DECLARE actor users; result jsonb; item jsonb; module_name text; action_name text;
BEGIN
 SELECT * INTO actor FROM users WHERE id=p_actor AND status='approved' AND NOT is_deleted;
 IF NOT FOUND THEN RAISE EXCEPTION 'Active account required' USING ERRCODE='42501'; END IF;
 IF p_table NOT IN ('customer','product','pricehist','employee','department','job','jobhistory','sales','salesdetail','payment') OR jsonb_typeof(p_key) IS DISTINCT FROM 'object' OR p_key='{}'::jsonb THEN RAISE EXCEPTION 'Invalid record'; END IF;
 WITH RECURSIVE nodes AS (
  SELECT 'customer' t,jsonb_build_object('custno',custno) k,to_jsonb(c) d FROM customer c UNION ALL
  SELECT 'product',jsonb_build_object('prodcode',prodcode),to_jsonb(p) FROM product p UNION ALL
  SELECT 'pricehist',jsonb_build_object('effdate',effdate,'prodcode',prodcode),to_jsonb(p) FROM pricehist p UNION ALL
  SELECT 'employee',jsonb_build_object('empno',empno),to_jsonb(e) FROM employee e UNION ALL
  SELECT 'department',jsonb_build_object('deptcode',deptcode),to_jsonb(d) FROM department d UNION ALL
  SELECT 'job',jsonb_build_object('jobcode',jobcode),to_jsonb(j) FROM job j UNION ALL
  SELECT 'jobhistory',jsonb_build_object('empno',empno,'jobcode',jobcode,'effdate',effdate),to_jsonb(j) FROM jobhistory j UNION ALL
  SELECT 'sales',jsonb_build_object('transno',transno),to_jsonb(s) FROM sales s UNION ALL
  SELECT 'salesdetail',jsonb_build_object('transno',transno,'prodcode',prodcode),to_jsonb(s) FROM salesdetail s UNION ALL
  SELECT 'payment',jsonb_build_object('orno',orno),to_jsonb(p) FROM payment p
 ), edges AS (
  SELECT parent.t pt,parent.k pk,child.t ct,child.k ck FROM nodes parent JOIN nodes child ON
   (parent.t='customer' AND child.t='sales' AND parent.d->>'custno'=child.d->>'custno') OR
   (parent.t='employee' AND child.t IN ('sales','jobhistory') AND parent.d->>'empno'=child.d->>'empno') OR
   (parent.t='department' AND child.t='job' AND parent.d->>'deptcode'=child.d->>'deptcode') OR
   (parent.t='department' AND child.t='jobhistory' AND parent.d->>'deptcode'=child.d->>'deptcode') OR
   (parent.t='job' AND child.t='jobhistory' AND parent.d->>'jobcode'=child.d->>'jobcode') OR
   (parent.t='product' AND child.t IN ('pricehist','salesdetail') AND parent.d->>'prodcode'=child.d->>'prodcode') OR
   (parent.t='sales' AND child.t IN ('salesdetail','payment') AND parent.d->>'transno'=child.d->>'transno')
 ), walk(t,k) AS (
  SELECT t,k FROM nodes WHERE t=p_table AND k=p_key AND NOT (d->>'is_deleted')::boolean
  UNION SELECT e.ct,e.ck FROM edges e JOIN walk w ON e.pt=w.t AND e.pk=w.k
 ) SELECT jsonb_agg(jsonb_build_object('table',n.t,'key',n.k,'updated_at',n.d->'updated_at') ORDER BY CASE WHEN n.t IN ('pricehist','salesdetail','payment','jobhistory') THEN 0 WHEN n.t='sales' THEN 1 WHEN n.t='department' THEN 3 ELSE 2 END,n.t,n.k::text) INTO result
 FROM walk w JOIN nodes n ON n.t=w.t AND n.k=w.k WHERE NOT (n.d->>'is_deleted')::boolean;
 IF result IS NULL THEN RAISE EXCEPTION 'Active record not found' USING ERRCODE='P0002'; END IF;
 FOR item IN SELECT value FROM jsonb_array_elements(result) LOOP
  module_name:=CASE WHEN item->>'table'='customer' THEN 'customers' WHEN item->>'table' IN ('product','pricehist') THEN 'products' WHEN item->>'table' IN ('employee','department','job','jobhistory') THEN 'hr' ELSE 'sales' END;
  action_name:=CASE item->>'table' WHEN 'pricehist' THEN 'priceDelete' WHEN 'employee' THEN 'empDelete' WHEN 'department' THEN 'deptDelete' WHEN 'job' THEN 'jobDelete' WHEN 'jobhistory' THEN 'jhDelete' WHEN 'salesdetail' THEN 'detailDelete' ELSE 'delete' END;
  IF actor.role<>'superadmin' AND (coalesce(actor.rights->>(module_name||'.view'),'false')<>'true' OR coalesce(actor.rights->>(module_name||'.'||action_name),'false')<>'true') THEN RAISE EXCEPTION 'Permission required to make related % records inactive',item->>'table' USING ERRCODE='42501'; END IF;
 END LOOP;
 RETURN result;
END $$;

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
            SELECT count(*) INTO v_n FROM (SELECT 1 FROM jobhistory WHERE deptcode=OLD.deptcode AND NOT is_deleted UNION ALL SELECT 1 FROM job WHERE deptcode=OLD.deptcode AND NOT is_deleted) children;
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



CREATE OR REPLACE FUNCTION hope_hr_record_members(p_actor uuid,p_kind text,p_code text) RETURNS jsonb LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
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
  'jobs',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.jobcode),'[]'::jsonb) FROM (SELECT DISTINCT j.jobcode,j.jobname FROM job j WHERE NOT j.is_deleted AND ((p_kind='jobs' AND j.jobcode=p_code AND EXISTS(SELECT 1 FROM current_members)) OR (p_kind='departments' AND (j.deptcode=p_code OR (j.deptcode IS NULL AND EXISTS(SELECT 1 FROM current_members m WHERE m.jobcode=j.jobcode)))))) x),
  'departments',(SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.deptname,x.deptcode),'[]'::jsonb) FROM (SELECT d.deptcode,d.deptname FROM department d WHERE NOT d.is_deleted AND ((p_kind='departments' AND d.deptcode=p_code) OR (p_kind='jobs' AND (d.deptcode=(SELECT deptcode FROM job WHERE jobcode=p_code) OR ((SELECT deptcode FROM job WHERE jobcode=p_code) IS NULL AND EXISTS(SELECT 1 FROM current_members m WHERE m.deptcode=d.deptcode)))))) x)
 ) INTO result;
 RETURN result;
END $$;

CREATE OR REPLACE FUNCTION hope_report(p_report text,p_from date DEFAULT NULL,p_to date DEFAULT NULL,p_top int DEFAULT 10,p_employee text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
DECLARE result jsonb;
BEGIN
 IF p_top NOT BETWEEN 1 AND 100 OR p_from>p_to THEN RAISE EXCEPTION 'Invalid report filters'; END IF;
 IF p_report IN ('topCustomers','topProducts','topSales') AND EXISTS(
  SELECT 1 FROM sales_line_value WHERE unitprice IS NULL AND (p_from IS NULL OR salesdate>=p_from) AND (p_to IS NULL OR salesdate<=p_to))
 THEN RAISE EXCEPTION 'Report cannot be calculated: a sale has no effective price'; END IF;
 CASE p_report
 WHEN 'topCustomers' THEN
  SELECT coalesce(jsonb_agg(to_jsonb(x)),'[]') INTO result FROM (
   SELECT c.custno,c.custname,sum(v.line_total) total FROM customer c JOIN sales_line_value v USING(custno)
   WHERE NOT c.is_deleted AND (p_from IS NULL OR v.salesdate>=p_from) AND (p_to IS NULL OR v.salesdate<=p_to)
   GROUP BY c.custno,c.custname ORDER BY total DESC,c.custno LIMIT p_top) x;
 WHEN 'topProducts' THEN
  SELECT coalesce(jsonb_agg(to_jsonb(x)),'[]') INTO result FROM (
   SELECT p.prodcode,p.description,sum(v.quantity) quantity,sum(v.line_total) total
   FROM product p JOIN sales_line_value v USING(prodcode) WHERE NOT p.is_deleted
   AND (p_from IS NULL OR v.salesdate>=p_from) AND (p_to IS NULL OR v.salesdate<=p_to)
   GROUP BY p.prodcode,p.description ORDER BY total DESC,p.prodcode LIMIT p_top) x;
 WHEN 'topSales' THEN
  SELECT coalesce(jsonb_agg(to_jsonb(x)),'[]') INTO result FROM (
   SELECT transno,salesdate,custno,empno,total,paid,balance FROM sales_balance
   WHERE (p_from IS NULL OR salesdate>=p_from) AND (p_to IS NULL OR salesdate<=p_to)
   ORDER BY total DESC,transno LIMIT p_top) x;
 WHEN 'productMaster' THEN
  SELECT coalesce(jsonb_agg(to_jsonb(x)),'[]') INTO result FROM (
   SELECT prodcode,description,unit,unitprice,effdate FROM product_current_price ORDER BY prodcode) x;
 WHEN 'activeEmployees' THEN
  SELECT coalesce(jsonb_agg(to_jsonb(x)),'[]') INTO result FROM (
   SELECT empno,firstname,lastname,hiredate,sepdate FROM employee WHERE NOT is_deleted
   AND hiredate<=current_date AND (sepdate IS NULL OR sepdate>current_date) ORDER BY lastname,firstname,empno) x;
 WHEN 'allEmployees' THEN
  SELECT coalesce(jsonb_agg(to_jsonb(x)),'[]') INTO result FROM (
   SELECT empno,firstname,lastname,hiredate,sepdate FROM employee WHERE NOT is_deleted ORDER BY lastname,firstname,empno) x;
 WHEN 'empJobHistory' THEN
  IF p_employee IS NULL THEN RAISE EXCEPTION 'Select an employee'; END IF;
  SELECT coalesce(jsonb_agg(to_jsonb(x)),'[]') INTO result FROM (
   SELECT h.empno,e.firstname,e.lastname,h.effdate,h.salary,h.jobcode,j.jobdesc,h.deptcode,d.deptname
   FROM jobhistory h JOIN employee e USING(empno) JOIN job j USING(jobcode) LEFT JOIN department d ON d.deptcode=h.deptcode
   WHERE NOT h.is_deleted AND NOT e.is_deleted AND h.empno=p_employee
   AND (p_from IS NULL OR h.effdate>=p_from) AND (p_to IS NULL OR h.effdate<=p_to) ORDER BY h.effdate,h.jobcode) x;
 ELSE RAISE EXCEPTION 'Unknown report';
 END CASE;
 RETURN result;
END $$;

INSERT INTO app_migration(version) VALUES('202611080014_job_departments');
NOTIFY pgrst,'reload schema';
-- migrate:down
DO $$ BEGIN RAISE EXCEPTION 'Forward-only migration'; END $$;
