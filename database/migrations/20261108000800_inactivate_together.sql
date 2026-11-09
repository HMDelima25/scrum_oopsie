-- migrate:up
UPDATE rights SET label='Make '||substring(label FROM 8)||' inactive' WHERE label LIKE 'Delete %';
CREATE FUNCTION hope_inactivation_plan(p_actor uuid,p_table text,p_key jsonb) RETURNS jsonb LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
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
   (parent.t='department' AND child.t='jobhistory' AND parent.d->>'deptcode'=child.d->>'deptcode') OR
   (parent.t='job' AND child.t='jobhistory' AND parent.d->>'jobcode'=child.d->>'jobcode') OR
   (parent.t='product' AND child.t IN ('pricehist','salesdetail') AND parent.d->>'prodcode'=child.d->>'prodcode') OR
   (parent.t='sales' AND child.t IN ('salesdetail','payment') AND parent.d->>'transno'=child.d->>'transno')
 ), walk(t,k) AS (
  SELECT t,k FROM nodes WHERE t=p_table AND k=p_key AND NOT (d->>'is_deleted')::boolean
  UNION SELECT e.ct,e.ck FROM edges e JOIN walk w ON e.pt=w.t AND e.pk=w.k
 ) SELECT jsonb_agg(jsonb_build_object('table',n.t,'key',n.k,'updated_at',n.d->'updated_at') ORDER BY CASE WHEN n.t IN ('pricehist','salesdetail','payment','jobhistory') THEN 0 WHEN n.t='sales' THEN 1 ELSE 2 END,n.t,n.k::text) INTO result
 FROM walk w JOIN nodes n ON n.t=w.t AND n.k=w.k WHERE NOT (n.d->>'is_deleted')::boolean;
 IF result IS NULL THEN RAISE EXCEPTION 'Active record not found' USING ERRCODE='P0002'; END IF;
 FOR item IN SELECT value FROM jsonb_array_elements(result) LOOP
  module_name:=CASE WHEN item->>'table'='customer' THEN 'customers' WHEN item->>'table' IN ('product','pricehist') THEN 'products' WHEN item->>'table' IN ('employee','department','job','jobhistory') THEN 'hr' ELSE 'sales' END;
  action_name:=CASE item->>'table' WHEN 'pricehist' THEN 'priceDelete' WHEN 'employee' THEN 'empDelete' WHEN 'department' THEN 'deptDelete' WHEN 'job' THEN 'jobDelete' WHEN 'jobhistory' THEN 'jhDelete' WHEN 'salesdetail' THEN 'detailDelete' ELSE 'delete' END;
  IF actor.role<>'superadmin' AND (coalesce(actor.rights->>(module_name||'.view'),'false')<>'true' OR coalesce(actor.rights->>(module_name||'.'||action_name),'false')<>'true') THEN RAISE EXCEPTION 'Permission required to make related % records inactive',item->>'table' USING ERRCODE='42501'; END IF;
 END LOOP;
 RETURN result;
END $$;
CREATE FUNCTION hope_inactivate_together(p_actor uuid,p_table text,p_key jsonb,p_plan jsonb) RETURNS jsonb LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
DECLARE current_plan jsonb; item jsonb; result jsonb;
BEGIN
 -- Prevent relationship changes between checking the preview and updating its rows.
 LOCK TABLE customer,product,pricehist,employee,department,job,jobhistory,sales,salesdetail,payment IN SHARE ROW EXCLUSIVE MODE;
 PERFORM 1 FROM users WHERE id=p_actor FOR SHARE;
 current_plan:=hope_inactivation_plan(p_actor,p_table,p_key);
 IF current_plan IS DISTINCT FROM p_plan THEN RAISE EXCEPTION 'Records changed. Review the updated confirmation before continuing.' USING ERRCODE='40001'; END IF;
 FOR item IN SELECT value FROM jsonb_array_elements(current_plan) LOOP
  result:=hope_mutate(p_actor,item->>'table','update',item->'key','{"is_deleted":true}'::jsonb);
 END LOOP;
 RETURN jsonb_build_object('affected',jsonb_array_length(current_plan));
END $$;
REVOKE ALL ON FUNCTION hope_inactivation_plan(uuid,text,jsonb),hope_inactivate_together(uuid,text,jsonb,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION hope_inactivation_plan(uuid,text,jsonb),hope_inactivate_together(uuid,text,jsonb,jsonb) TO service_role;
INSERT INTO app_migration(version) VALUES('202611080008_inactivate_together');
NOTIFY pgrst,'reload schema';
-- migrate:down
DO $$ BEGIN RAISE EXCEPTION 'Forward-only migration'; END $$;
