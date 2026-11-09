-- migrate:up
CREATE TABLE record_code_counter(kind text NOT NULL,prefix text NOT NULL,last_number bigint NOT NULL,PRIMARY KEY(kind,prefix));
ALTER TABLE record_code_counter ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON record_code_counter FROM PUBLIC,anon,authenticated;
GRANT ALL ON record_code_counter TO service_role;
CREATE FUNCTION hope_next_code(p_table text,p_prefix text DEFAULT NULL,p_reserve boolean DEFAULT false) RETURNS text
LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
DECLARE col text; capacity int; v_prefix text; width int; step int:=1; largest bigint; saved bigint:=0; candidate bigint;
BEGIN
 SELECT v.c,v.n,v.p INTO col,capacity,v_prefix FROM (VALUES
 ('customer','custno',5,'C'),('employee','empno',5,''),('sales','transno',8,'TR'),('payment','orno',8,'OR'),
 ('product','prodcode',6,'AD'),('department','deptcode',3,'AC'),('job','jobcode',4,'SA')) v(t,c,n,p) WHERE v.t=p_table;
 IF col IS NULL THEN RAISE EXCEPTION 'Unsupported automatic code table'; END IF;
 v_prefix:=coalesce(p_prefix,v_prefix);
 IF (p_table='employee' AND v_prefix<>'') OR (p_table='customer' AND v_prefix<>'C') OR (p_table='sales' AND v_prefix<>'TR') OR (p_table='payment' AND v_prefix<>'OR')
 OR (p_table IN ('product','department','job') AND (v_prefix!~'^[A-Z]+$' OR length(v_prefix)>=capacity)) THEN RAISE EXCEPTION 'Invalid code v_prefix'; END IF;
 width:=capacity-length(v_prefix);
 IF p_table='employee' THEN step:=2; END IF;
 IF p_reserve THEN
  INSERT INTO record_code_counter VALUES(p_table,v_prefix,0) ON CONFLICT DO NOTHING;
  SELECT last_number INTO saved FROM record_code_counter WHERE kind=p_table AND record_code_counter.prefix=v_prefix FOR UPDATE;
 ELSE SELECT coalesce(max(last_number),0) INTO saved FROM record_code_counter WHERE kind=p_table AND record_code_counter.prefix=v_prefix;
 END IF;
 EXECUTE format('SELECT max(substring(%I from %s)::bigint),max(length(substring(%I from %s))) FROM %I WHERE %I ~ $1',col,length(v_prefix)+1,col,length(v_prefix)+1,p_table,col)
 INTO largest,candidate USING '^'||v_prefix||'[0-9]+$';
 IF p_table IN ('department','job') AND candidate IS NOT NULL THEN width:=least(width,candidate::int); END IF;
 candidate:=greatest(coalesce(largest,CASE WHEN step=2 THEN -1 ELSE 0 END),CASE WHEN saved=0 AND step=2 AND largest IS NULL THEN -1 ELSE saved END)+step;
 IF length(candidate::text)>capacity-length(v_prefix) THEN RAISE EXCEPTION 'Code range exhausted'; END IF;
 IF p_reserve THEN UPDATE record_code_counter SET last_number=candidate WHERE kind=p_table AND record_code_counter.prefix=v_prefix; END IF;
 RETURN v_prefix||lpad(candidate::text,greatest(width,length(candidate::text)),'0');
END $$;
CREATE FUNCTION hope_insert_auto(p_actor uuid,p_table text,p_data jsonb,p_prefix text DEFAULT NULL) RETURNS jsonb
LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
DECLARE col text;
BEGIN
 col:=CASE p_table WHEN 'customer' THEN 'custno' WHEN 'employee' THEN 'empno' WHEN 'product' THEN 'prodcode' WHEN 'department' THEN 'deptcode' WHEN 'job' THEN 'jobcode' WHEN 'payment' THEN 'orno' END;
 IF col IS NULL THEN RAISE EXCEPTION 'Unsupported automatic code table'; END IF;
 IF NOT p_data?col OR coalesce(p_data->>col,'')='' THEN p_data:=p_data||jsonb_build_object(col,hope_next_code(p_table,p_prefix,true)); END IF;
 RETURN hope_mutate(p_actor,p_table,'insert','{}',p_data);
END $$;
CREATE FUNCTION hope_fill_sale_code() RETURNS trigger LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
BEGIN IF NEW.transno IS NULL OR NEW.transno='' THEN NEW.transno:=hope_next_code('sales',NULL,true); END IF; RETURN NEW; END $$;
ALTER TABLE sales ALTER COLUMN transno DROP DEFAULT;
CREATE TRIGGER sales_auto_code BEFORE INSERT ON sales FOR EACH ROW EXECUTE FUNCTION hope_fill_sale_code();
REVOKE ALL ON FUNCTION hope_next_code(text,text,boolean),hope_insert_auto(uuid,text,jsonb,text),hope_fill_sale_code() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION hope_next_code(text,text,boolean),hope_insert_auto(uuid,text,jsonb,text),hope_fill_sale_code() TO service_role;
INSERT INTO app_migration(version) VALUES('202611070005_automatic_codes');
NOTIFY pgrst,'reload schema';
-- migrate:down
DO $$ BEGIN RAISE EXCEPTION 'Forward-only migration'; END $$;
