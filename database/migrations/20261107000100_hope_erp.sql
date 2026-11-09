-- migrate:up
-- HOPE ERP business schema, adapted from the supplied HopeDB_audit.sql.txt.
-- No sample business rows, drops, or replacement of existing team migrations.
CREATE TABLE employee (empno VARCHAR(5) NOT NULL PRIMARY KEY, 
												lastname VARCHAR(15),  
												firstname VARCHAR(15), 
												gender CHAR(1) CONSTRAINT gender_ck CHECK (gender in ('M','F')), 
												birthdate DATE, 
												hiredate DATE, 
												sepDate DATE);

CREATE TABLE department (deptCode VARCHAR(3) NOT NULL,
												  deptName VARCHAR (20), 
												  PRIMARY KEY (deptCode)) ;

CREATE TABLE job (jobCode VARCHAR(4) NOT NULL PRIMARY KEY, 
									 jobDesc VARCHAR(20)) ;

CREATE TABLE jobHistory (empNo VARCHAR(5) NOT NULL REFERENCES employee,
												  jobCode VARCHAR(4) NOT NULL REFERENCES job, 
												  effDate DATE NOT NULL , 
												  salary DECIMAL(10,2) CONSTRAINT salary_ck 
												  CHECK (salary >= 0.0), deptCode VARCHAR(4),
												  PRIMARY KEY (empNo, jobCode,effDate), 
												  FOREIGN KEY (deptCode) REFERENCES department);

CREATE TABLE customer (custno VARCHAR(5) NOT NULL PRIMARY KEY, 
											   custname VARCHAR(20), 
											   address VARCHAR(50), 
											   payterm VARCHAR(3) CONSTRAINT pay_ck 
											   CHECK (payterm IN ('COD', '30D', '45D'))) ;

CREATE TABLE  sales (transNo VARCHAR(8) NOT NULL PRIMARY KEY, 
												salesDate DATE, 
												custNo VARCHAR(5), 
												empNo VARCHAR(5), 	
												FOREIGN KEY (custNo) REFERENCES customer, 
												FOREIGN KEY (empno) REFERENCES employee);

CREATE TABLE product (prodCode VARCHAR(6) NOT NULL PRIMARY KEY, 
											description VARCHAR(30), 
											unit VARCHAR(3) CONSTRAINT unit_ck 
											CHECK (unit IN ('pc','ea','mtr','pkg','ltr')));

CREATE TABLE salesDetail (transNo VARCHAR(8) NOT NULL REFERENCES sales, 
													prodCode VARCHAR(6) NOT NULL REFERENCES product, 
													quantity DECIMAL(10,2) CONSTRAINT quantity_ck 
													CHECK (quantity >= 0.0), 
													PRIMARY KEY (transNo, prodCode));

CREATE TABLE payment (orNo VARCHAR(8) NOT NULL PRIMARY KEY, 
											  payDate DATE, 
											  amount DECIMAL(10,2), 
											  transno VARCHAR(8) REFERENCES  sales);

CREATE TABLE priceHist (effDate DATE NOT NULL, 
											   prodCode VARCHAR(6) NOT NULL REFERENCES product, 
											   unitPrice DECIMAL(10,2) CONSTRAINT unitP_ck 
											   CHECK (unitPrice > 0),  
											   PRIMARY KEY (effDate, prodCode));
CREATE TABLE audit_log (
    audit_id    BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    table_name  VARCHAR(30) NOT NULL,
    action      VARCHAR(7)  NOT NULL CHECK (action IN ('ADD','EDIT','DELETE','RESTORE')),
    record_key  TEXT,             -- primary key value(s), joined with '|'
    old_values  JSONB,                   -- NULL for ADD
    new_values  JSONB,
    action_by   TEXT NOT NULL,
    action_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Helper functions ---------------------------------------------------
-- Who is acting? If the application sets  SET app.username = 'user1'
-- (e.g. because everyone shares one DB login) that name is used; otherwise
-- the database login name is used.
CREATE OR REPLACE FUNCTION audit_user() RETURNS TEXT
LANGUAGE sql STABLE AS $$
    SELECT COALESCE(NULLIF(current_setting('app.username', true), ''),
                    session_user::text);
$$;

-- Builds the stamp text, e.g.  EDIT user1 2026-10-12 11:18 AM
-- (time shown in Asia/Manila; change the zone here if needed)
CREATE OR REPLACE FUNCTION audit_stamp(p_action TEXT) RETURNS TEXT
LANGUAGE sql STABLE AS $$
    SELECT p_action || ' ' || audit_user() || ' ' ||
           to_char(now() AT TIME ZONE 'Asia/Manila', 'YYYY-MM-DD HH12:MI AM');
$$;

-- 3. Trigger functions --------------------------------------------------

-- 3a. Sets the stamp column on every INSERT / UPDATE
CREATE OR REPLACE FUNCTION trg_set_stamp() RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        NEW.stamp := audit_stamp('ADD');
    ELSIF (to_jsonb(OLD) - 'stamp') = (to_jsonb(NEW) - 'stamp') THEN
        NEW.stamp := OLD.stamp;                      -- nothing changed
    ELSIF NOT OLD.is_deleted AND NEW.is_deleted THEN
        NEW.stamp := audit_stamp('DELETE');
    ELSIF OLD.is_deleted AND NOT NEW.is_deleted THEN
        NEW.stamp := audit_stamp('RESTORE');
    ELSE
        NEW.stamp := audit_stamp('EDIT');
    END IF;
    RETURN NEW;
END;
$$;

-- 3b. Writes the history row to audit_log (key columns passed as arguments)
CREATE OR REPLACE FUNCTION trg_audit_log() RETURNS TRIGGER
LANGUAGE plpgsql AS $$
DECLARE
    v_action TEXT;
    v_key    TEXT;
BEGIN
    SELECT string_agg(to_jsonb(NEW) ->> k, '|' ORDER BY ord)
      INTO v_key
      FROM unnest(TG_ARGV) WITH ORDINALITY AS t(k, ord);

    IF TG_OP = 'INSERT' THEN
        INSERT INTO audit_log (table_name, action, record_key, old_values, new_values, action_by)
        VALUES (TG_TABLE_NAME, 'ADD', v_key, NULL, to_jsonb(NEW), audit_user());
    ELSE
        IF (to_jsonb(OLD) - 'stamp') = (to_jsonb(NEW) - 'stamp') THEN
            RETURN NULL;                             -- nothing changed, no log
        END IF;
        v_action := CASE
                      WHEN NOT OLD.is_deleted AND NEW.is_deleted THEN 'DELETE'
                      WHEN OLD.is_deleted AND NOT NEW.is_deleted THEN 'RESTORE'
                      ELSE 'EDIT'
                    END;
        INSERT INTO audit_log (table_name, action, record_key, old_values, new_values, action_by)
        VALUES (TG_TABLE_NAME, v_action, v_key, to_jsonb(OLD), to_jsonb(NEW), audit_user());
    END IF;
    RETURN NULL;
END;
$$;

-- 3c. Blocks hard DELETE / TRUNCATE (soft delete only)
CREATE OR REPLACE FUNCTION trg_block_hard_delete() RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
    RAISE EXCEPTION 'Hard delete/truncate not allowed on %. Use UPDATE ... SET is_deleted = true.', TG_TABLE_NAME;
END;
$$;

-- 3d. Blocks any change to audit_log itself (history is append-only)
CREATE OR REPLACE FUNCTION trg_protect_audit_log() RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
    RAISE EXCEPTION 'audit_log is append-only.';
END;
$$;

-- 3e. A parent row cannot be soft-deleted while it still has active children
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

-- 4. Attach everything to the 10 tables ---------------------------------
DO $$
DECLARE
    r      RECORD;
    v_args TEXT;
BEGIN
    FOR r IN
        SELECT * FROM (VALUES
            ('employee',    'empno'),
            ('department',  'deptcode'),
            ('job',         'jobcode'),
            ('jobhistory',  'empno,jobcode,effdate'),
            ('customer',    'custno'),
            ('sales',       'transno'),
            ('salesdetail', 'transno,prodcode'),
            ('product',     'prodcode'),
            ('payment',     'orno'),
            ('pricehist',   'effdate,prodcode')
        ) AS t(tbl, keycols)
    LOOP
        -- new columns
        EXECUTE format('ALTER TABLE %I ADD COLUMN is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
                                      ADD COLUMN stamp TEXT', r.tbl);

        -- label the rows loaded by this script
        EXECUTE format('UPDATE %I SET stamp = %L', r.tbl,
                       'ADD system ' || to_char(now() AT TIME ZONE 'Asia/Manila', 'YYYY-MM-DD HH12:MI AM'));

        -- trigger arguments = quoted key column names
        SELECT string_agg(quote_literal(k), ',') INTO v_args
          FROM unnest(string_to_array(r.keycols, ',')) AS k;

        EXECUTE format('CREATE TRIGGER %I BEFORE UPDATE ON %I
                        FOR EACH ROW EXECUTE FUNCTION trg_check_children()',
                       r.tbl || '_bu_check', r.tbl);
        EXECUTE format('CREATE TRIGGER %I BEFORE INSERT OR UPDATE ON %I
                        FOR EACH ROW EXECUTE FUNCTION trg_set_stamp()',
                       r.tbl || '_biu_stamp', r.tbl);
        EXECUTE format('CREATE TRIGGER %I BEFORE DELETE ON %I
                        FOR EACH ROW EXECUTE FUNCTION trg_block_hard_delete()',
                       r.tbl || '_bd_block', r.tbl);
        EXECUTE format('CREATE TRIGGER %I BEFORE TRUNCATE ON %I
                        FOR EACH STATEMENT EXECUTE FUNCTION trg_block_hard_delete()',
                       r.tbl || '_bt_block', r.tbl);
        EXECUTE format('CREATE TRIGGER %I AFTER INSERT OR UPDATE ON %I
                        FOR EACH ROW EXECUTE FUNCTION trg_audit_log(%s)',
                       r.tbl || '_aiu_audit', r.tbl, v_args);

        -- view of active (not deleted) rows
        EXECUTE format('CREATE VIEW %I AS SELECT * FROM %I WHERE NOT is_deleted',
                       r.tbl || '_active', r.tbl);
    END LOOP;
END;
$$;

-- audit_log is append-only
CREATE TRIGGER audit_log_protect_row
    BEFORE UPDATE OR DELETE ON audit_log
    FOR EACH ROW EXECUTE FUNCTION trg_protect_audit_log();
CREATE TRIGGER audit_log_protect_truncate
    BEFORE TRUNCATE ON audit_log
    FOR EACH STATEMENT EXECUTE FUNCTION trg_protect_audit_log();

-- =====================================================================

CREATE TABLE role (name text PRIMARY KEY CHECK(name IN ('superadmin','admin','user')));
INSERT INTO role VALUES ('superadmin'),('admin'),('user');
CREATE TABLE module (name text PRIMARY KEY);
INSERT INTO module VALUES ('customers'),('products'),('hr'),('sales'),('reports');
CREATE TABLE rights (key text PRIMARY KEY, module_name text NOT NULL REFERENCES module(name), label text NOT NULL);
CREATE TABLE users (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), email text NOT NULL CHECK(length(email)<=254),
 name text NOT NULL CHECK(length(name) BETWEEN 1 AND 160),
 password_hash text, role text NOT NULL DEFAULT 'user' REFERENCES role(name),
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','blocked')),
 rights jsonb NOT NULL DEFAULT '{}' CHECK(jsonb_typeof(rights)='object'),
 reset_token text, reset_token_expires timestamptz,
 auth_version integer NOT NULL DEFAULT 0, is_deleted boolean NOT NULL DEFAULT false,
 created_at timestamptz NOT NULL DEFAULT now(), stamp text
);
CREATE UNIQUE INDEX users_email_lower ON users(lower(email));
CREATE TABLE user_permission (
 user_id uuid REFERENCES users(id), right_key text REFERENCES rights(key),
 allowed boolean NOT NULL DEFAULT true, PRIMARY KEY(user_id,right_key)
);
CREATE TABLE user_token (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES users(id),
 token_hash text UNIQUE NOT NULL, purpose text NOT NULL CHECK(purpose IN ('setup','reset')),
 expires_at timestamptz NOT NULL, used_at timestamptz, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE app_session (sid text PRIMARY KEY, sess jsonb NOT NULL, expires_at timestamptz NOT NULL);
CREATE INDEX app_session_expiry ON app_session(expires_at);
CREATE TABLE app_setting (key text PRIMARY KEY, value jsonb NOT NULL, updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE app_migration (version text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now());
INSERT INTO rights VALUES ('customers.view','customers','View Customers');
INSERT INTO rights VALUES ('customers.add','customers','Add Customer');
INSERT INTO rights VALUES ('customers.edit','customers','Edit Customer');
INSERT INTO rights VALUES ('customers.delete','customers','Delete Customer');
INSERT INTO rights VALUES ('products.view','products','View Products');
INSERT INTO rights VALUES ('products.add','products','Add Product');
INSERT INTO rights VALUES ('products.edit','products','Edit Product');
INSERT INTO rights VALUES ('products.delete','products','Delete Product');
INSERT INTO rights VALUES ('products.priceAdd','products','Add Price');
INSERT INTO rights VALUES ('products.priceEdit','products','Edit Price');
INSERT INTO rights VALUES ('products.priceDelete','products','Delete Price');
INSERT INTO rights VALUES ('hr.view','hr','View Human Resources');
INSERT INTO rights VALUES ('hr.jobAdd','hr','Add Job');
INSERT INTO rights VALUES ('hr.jobEdit','hr','Edit Job');
INSERT INTO rights VALUES ('hr.jobDelete','hr','Delete Job');
INSERT INTO rights VALUES ('hr.deptAdd','hr','Add Department');
INSERT INTO rights VALUES ('hr.deptEdit','hr','Edit Department');
INSERT INTO rights VALUES ('hr.deptDelete','hr','Delete Department');
INSERT INTO rights VALUES ('hr.empAdd','hr','Add Employee');
INSERT INTO rights VALUES ('hr.empEdit','hr','Edit Employee');
INSERT INTO rights VALUES ('hr.empDelete','hr','Delete Employee');
INSERT INTO rights VALUES ('hr.jhView','hr','View Job History');
INSERT INTO rights VALUES ('hr.jhAdd','hr','Add Job History');
INSERT INTO rights VALUES ('hr.jhEdit','hr','Edit Job History');
INSERT INTO rights VALUES ('hr.jhDelete','hr','Delete Job History');
INSERT INTO rights VALUES ('sales.view','sales','View Sales');
INSERT INTO rights VALUES ('sales.add','sales','Add Sale');
INSERT INTO rights VALUES ('sales.edit','sales','Edit Sale');
INSERT INTO rights VALUES ('sales.delete','sales','Delete Sale');
INSERT INTO rights VALUES ('sales.detailView','sales','View Sale Details');
INSERT INTO rights VALUES ('sales.detailAdd','sales','Add Sale Detail');
INSERT INTO rights VALUES ('sales.detailEdit','sales','Edit Sale Detail');
INSERT INTO rights VALUES ('sales.detailDelete','sales','Delete Sale Detail');
INSERT INTO rights VALUES ('reports.view','reports','View Reports');
INSERT INTO rights VALUES ('reports.topCustomers','reports','Top Customers');
INSERT INTO rights VALUES ('reports.productMaster','reports','Product Master List');
INSERT INTO rights VALUES ('reports.topProducts','reports','Top Products');
INSERT INTO rights VALUES ('reports.activeEmployees','reports','Active Employees');
INSERT INTO rights VALUES ('reports.allEmployees','reports','All Employees');
INSERT INTO rights VALUES ('reports.empJobHistory','reports','Employee Job History');
INSERT INTO rights VALUES ('reports.topSales','reports','Top Sales');

-- Prevent concurrent changes from removing the last active Superadmin.
CREATE FUNCTION hope_guard_user() RETURNS trigger LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
BEGIN
 PERFORM pg_advisory_xact_lock(704211);
 IF TG_OP='UPDATE' AND OLD.role='superadmin' AND OLD.status='approved' AND NOT OLD.is_deleted
 AND (NEW.role<>'superadmin' OR NEW.status<>'approved' OR NEW.is_deleted)
 AND NOT EXISTS(SELECT 1 FROM users WHERE role='superadmin' AND status='approved' AND NOT is_deleted AND id<>OLD.id)
 THEN RAISE EXCEPTION 'Cannot disable the last active Superadmin' USING ERRCODE='23514'; END IF;
 IF TG_OP='UPDATE' AND (NEW.status IS DISTINCT FROM OLD.status OR NEW.role IS DISTINCT FROM OLD.role
   OR NEW.password_hash IS DISTINCT FROM OLD.password_hash OR NEW.is_deleted IS DISTINCT FROM OLD.is_deleted)
 THEN NEW.auth_version=OLD.auth_version+1; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER users_aa_guard BEFORE INSERT OR UPDATE ON users FOR EACH ROW EXECUTE FUNCTION hope_guard_user();
CREATE TRIGGER users_stamp BEFORE INSERT OR UPDATE ON users FOR EACH ROW EXECUTE FUNCTION trg_set_stamp();
CREATE TRIGGER users_no_delete BEFORE DELETE ON users FOR EACH ROW EXECUTE FUNCTION trg_block_hard_delete();
-- User audits never retain password/token material or session contents.
CREATE FUNCTION hope_audit_user() RETURNS trigger LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
DECLARE before_row jsonb; after_row jsonb;
BEGIN
 after_row=to_jsonb(NEW)-ARRAY['password_hash','reset_token','reset_token_expires','stamp'];
 IF TG_OP='UPDATE' THEN before_row=to_jsonb(OLD)-ARRAY['password_hash','reset_token','reset_token_expires','stamp']; END IF;
 IF TG_OP='INSERT' OR before_row IS DISTINCT FROM after_row OR NEW.password_hash IS DISTINCT FROM OLD.password_hash THEN
 INSERT INTO audit_log(table_name,action,record_key,old_values,new_values,action_by)
 VALUES('users',CASE WHEN TG_OP='INSERT' THEN 'ADD' ELSE 'EDIT' END,NEW.id::text,before_row,after_row,audit_user());
 END IF;
 DELETE FROM user_permission WHERE user_id=NEW.id;
 INSERT INTO user_permission SELECT NEW.id,r.key,true FROM rights r WHERE NEW.rights->>r.key='true';
 RETURN NULL;
END $$;
CREATE TRIGGER users_audit AFTER INSERT OR UPDATE ON users FOR EACH ROW EXECUTE FUNCTION hope_audit_user();

-- Reference reports use the most recent active price effective on the sale date.
CREATE VIEW sales_line_value WITH (security_invoker=true) AS
 SELECT d.transno,d.prodcode,d.quantity,s.salesdate,s.custno,s.empno,p.unitprice,
 round(d.quantity*p.unitprice,2) AS line_total
 FROM salesdetail d JOIN sales s USING(transno)
 LEFT JOIN LATERAL (SELECT unitprice FROM pricehist ph
 WHERE ph.prodcode=d.prodcode AND ph.effdate<=s.salesdate AND NOT ph.is_deleted
 ORDER BY ph.effdate DESC LIMIT 1) p ON true
 WHERE NOT d.is_deleted AND NOT s.is_deleted;
CREATE VIEW sales_balance WITH (security_invoker=true) AS
 SELECT s.*, coalesce(v.total,0) total,coalesce(p.paid,0) paid,
 coalesce(v.total,0)-coalesce(p.paid,0) balance,
 coalesce(v.missing_prices,0) missing_prices
 FROM sales s LEFT JOIN (SELECT transno,sum(line_total) total,
 count(*) FILTER(WHERE unitprice IS NULL) missing_prices FROM sales_line_value GROUP BY transno) v USING(transno)
 LEFT JOIN (SELECT transno,sum(amount) paid FROM payment WHERE NOT is_deleted GROUP BY transno) p USING(transno)
 WHERE NOT s.is_deleted;
CREATE VIEW product_current_price WITH (security_invoker=true) AS
 SELECT p.*,ph.unitprice,ph.effdate FROM product p
 LEFT JOIN LATERAL(SELECT unitprice,effdate FROM pricehist ph WHERE ph.prodcode=p.prodcode
 AND NOT ph.is_deleted AND ph.effdate<=current_date ORDER BY effdate DESC LIMIT 1) ph ON true
 WHERE NOT p.is_deleted;

CREATE INDEX sales_customer ON sales(custno);
CREATE INDEX sales_employee ON sales(empno);
CREATE INDEX payment_sale ON payment(transno);
CREATE INDEX salesdetail_product ON salesdetail(prodcode);
CREATE INDEX pricehist_product_date ON pricehist(prodcode,effdate DESC);
CREATE INDEX jobhistory_employee_date ON jobhistory(empno,effdate DESC);
CREATE INDEX audit_log_table_time ON audit_log(table_name,action_at DESC);
ALTER TABLE payment ADD CONSTRAINT payment_amount_nonnegative CHECK(amount>=0);

-- Atomic, allowlisted mutation; audit actor is scoped to the same transaction.
CREATE FUNCTION hope_mutate(p_actor uuid,p_table text,p_operation text,p_key jsonb DEFAULT '{}',p_data jsonb DEFAULT '{}')
RETURNS jsonb LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
DECLARE cols text; vals text; cond text; result jsonb; who users; field text; pk text[];
BEGIN
 SELECT * INTO who FROM users WHERE id=p_actor AND status='approved' AND NOT is_deleted FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Active account required' USING ERRCODE='42501'; END IF;
 IF p_table NOT IN ('customer','product','pricehist','employee','department','job','jobhistory','sales','salesdetail','payment','users') THEN
 RAISE EXCEPTION 'Unsupported table'; END IF;
 PERFORM set_config('app.username',who.email,true);
 IF p_table='users' THEN
   IF who.role NOT IN ('admin','superadmin') THEN RAISE EXCEPTION 'Admin required' USING ERRCODE='42501'; END IF;
   PERFORM pg_advisory_xact_lock(704211);
   IF p_operation='insert' AND who.role='admin' AND coalesce(p_data->>'role','user')<>'user'
   THEN RAISE EXCEPTION 'Admin manages Users only' USING ERRCODE='42501'; END IF;
   IF p_operation='update' THEN
    IF p_key->>'id'=p_actor::text THEN RAISE EXCEPTION 'Use account settings for your own account' USING ERRCODE='42501'; END IF;
    IF who.role='admin' AND ((SELECT role FROM users WHERE id=(p_key->>'id')::uuid)<>'user'
      OR (p_data?'role' AND p_data->>'role'<>'user'))
    THEN RAISE EXCEPTION 'Admin manages Users only' USING ERRCODE='42501'; END IF;
   END IF;
 ELSE
   IF p_data ?| ARRAY['stamp','is_deleted'] AND p_operation='insert' THEN RAISE EXCEPTION 'System fields are read-only'; END IF;
 END IF;
 IF p_operation NOT IN ('insert','update') THEN RAISE EXCEPTION 'Unsupported operation'; END IF;
 pk=CASE p_table WHEN 'customer' THEN ARRAY['custno'] WHEN 'product' THEN ARRAY['prodcode']
 WHEN 'employee' THEN ARRAY['empno'] WHEN 'department' THEN ARRAY['deptcode'] WHEN 'job' THEN ARRAY['jobcode']
 WHEN 'sales' THEN ARRAY['transno'] WHEN 'payment' THEN ARRAY['orno'] WHEN 'pricehist' THEN ARRAY['effdate','prodcode']
 WHEN 'salesdetail' THEN ARRAY['transno','prodcode'] WHEN 'jobhistory' THEN ARRAY['empno','jobcode','effdate'] ELSE ARRAY['id'] END;
 IF jsonb_typeof(p_data)<>'object' OR p_data='{}' THEN RAISE EXCEPTION 'Nonempty object required'; END IF;
 FOR field IN SELECT jsonb_object_keys(p_data) LOOP
   IF field IN ('stamp','auth_version','created_at') OR (p_operation='update' AND field=ANY(pk))
   OR NOT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name=p_table AND column_name=field)
   THEN RAISE EXCEPTION 'Invalid or immutable field: %',field; END IF;
 END LOOP;
 IF p_operation='insert' THEN
  SELECT string_agg(format('%I',k),','),string_agg(format('(jsonb_populate_record(NULL::%I,$1)).%I',p_table,k),',')
  INTO cols,vals FROM jsonb_object_keys(p_data) k;
  EXECUTE format('INSERT INTO %I(%s) SELECT %s RETURNING to_jsonb(%I.*)',p_table,cols,vals,p_table) INTO result USING p_data;
 ELSE
  IF (SELECT count(*) FROM jsonb_object_keys(p_key))<>cardinality(pk) OR NOT p_key ?& pk THEN RAISE EXCEPTION 'Complete primary key required'; END IF;
  SELECT string_agg(format('%I=(jsonb_populate_record(NULL::%I,$1)).%I',k,p_table,k),',') INTO vals FROM jsonb_object_keys(p_data) k;
  SELECT string_agg(format('%I=(jsonb_populate_record(NULL::%I,$2)).%I',k,p_table,k),' AND ') INTO cond FROM unnest(pk) k;
  EXECUTE format('UPDATE %I SET %s WHERE %s RETURNING to_jsonb(%I.*)',p_table,vals,cond,p_table) INTO result USING p_data,p_key;
  IF result IS NULL THEN RAISE EXCEPTION 'Record not found' USING ERRCODE='P0002'; END IF;
 END IF;
 RETURN result-ARRAY['password_hash','reset_token','reset_token_expires'];
END $$;

CREATE SEQUENCE sales_number START 1 MAXVALUE 999999;
ALTER TABLE sales ALTER COLUMN transno SET DEFAULT ('TR'||lpad(nextval('sales_number')::text,6,'0'));
CREATE FUNCTION hope_create_sale(p_actor uuid,p_header jsonb,p_lines jsonb) RETURNS jsonb
LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
DECLARE sale jsonb; item jsonb;
BEGIN
 IF jsonb_typeof(p_lines)<>'array' OR jsonb_array_length(p_lines)=0 THEN RAISE EXCEPTION 'At least one sale line required'; END IF;
 sale=hope_mutate(p_actor,'sales','insert','{}',p_header);
 FOR item IN SELECT * FROM jsonb_array_elements(p_lines) LOOP
  IF NOT EXISTS(SELECT 1 FROM pricehist WHERE prodcode=item->>'prodcode' AND NOT is_deleted
    AND effdate<=(p_header->>'salesdate')::date) THEN RAISE EXCEPTION 'No effective price for %',item->>'prodcode'; END IF;
  PERFORM hope_mutate(p_actor,'salesdetail','insert','{}',item||jsonb_build_object('transno',sale->>'transno'));
 END LOOP;
 RETURN sale;
END $$;

-- Claim tokens once atomically and invalidate previously issued sessions.
CREATE FUNCTION hope_consume_token(p_hash text,p_password_hash text) RETURNS uuid
LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
DECLARE uid uuid;
BEGIN
 UPDATE user_token SET used_at=now() WHERE token_hash=p_hash AND used_at IS NULL AND expires_at>now() RETURNING user_id INTO uid;
 IF uid IS NULL THEN RAISE EXCEPTION 'Invalid or expired password link' USING ERRCODE='22023'; END IF;
 UPDATE users SET password_hash=p_password_hash WHERE id=uid AND NOT is_deleted;
 IF NOT FOUND THEN RAISE EXCEPTION 'Account unavailable'; END IF;
 RETURN uid;
END $$;

-- Explicit grants: browser keys cannot read ERP/auth/session data.
DO $$ DECLARE t record; BEGIN
 FOR t IN SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename=ANY(ARRAY['employee','department','job','jobhistory','customer','sales','product','salesdetail','payment','pricehist','audit_log','role','module','rights','users','user_permission','user_token','app_session','app_setting','app_migration']) LOOP
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t.tablename);
  EXECUTE format('REVOKE ALL ON public.%I FROM anon,authenticated',t.tablename);
  EXECUTE format('GRANT SELECT,INSERT,UPDATE,DELETE ON public.%I TO service_role',t.tablename);
 END LOOP;
 FOR t IN SELECT viewname FROM pg_views WHERE schemaname='public' AND viewname=ANY(ARRAY['employee_active','department_active','job_active','jobhistory_active','customer_active','sales_active','product_active','salesdetail_active','payment_active','pricehist_active','sales_line_value','sales_balance','product_current_price']) LOOP
  EXECUTE format('ALTER VIEW public.%I SET (security_invoker=true)',t.viewname);
  EXECUTE format('REVOKE ALL ON public.%I FROM anon,authenticated',t.viewname);
  EXECUTE format('GRANT SELECT ON public.%I TO service_role',t.viewname);
 END LOOP;
END $$;
GRANT USAGE,SELECT ON SEQUENCE audit_log_audit_id_seq,sales_number TO service_role;
REVOKE EXECUTE ON FUNCTION hope_mutate(uuid,text,text,jsonb,jsonb),hope_create_sale(uuid,jsonb,jsonb),hope_consume_token(text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION hope_mutate(uuid,text,text,jsonb,jsonb),hope_create_sale(uuid,jsonb,jsonb),hope_consume_token(text,text) TO service_role;
CREATE FUNCTION hope_report(p_report text,p_from date DEFAULT NULL,p_to date DEFAULT NULL,p_top int DEFAULT 10,p_employee text DEFAULT NULL)
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
   FROM jobhistory h JOIN employee e USING(empno) JOIN job j USING(jobcode) LEFT JOIN department d USING(deptcode)
   WHERE NOT h.is_deleted AND NOT e.is_deleted AND h.empno=p_employee
   AND (p_from IS NULL OR h.effdate>=p_from) AND (p_to IS NULL OR h.effdate<=p_to) ORDER BY h.effdate,h.jobcode) x;
 ELSE RAISE EXCEPTION 'Unknown report';
 END CASE;
 RETURN result;
END $$;
REVOKE EXECUTE ON FUNCTION hope_report(text,date,date,int,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION hope_report(text,date,date,int,text) TO service_role;

-- A changed/new child or restored record must refer to an active parent.
CREATE FUNCTION hope_check_parent() RETURNS trigger LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
DECLARE item text; pair text[]; value text; active boolean;
BEGIN
 IF NEW.is_deleted THEN RETURN NEW; END IF;
 FOREACH item IN ARRAY TG_ARGV LOOP
  pair=string_to_array(item,':');value=to_jsonb(NEW)->>pair[3];
  IF value IS NULL THEN CONTINUE; END IF;
  IF TG_OP='UPDATE' AND NOT OLD.is_deleted AND to_jsonb(OLD)->>pair[3]=value THEN CONTINUE; END IF;
  EXECUTE format('SELECT NOT is_deleted FROM %I WHERE %I=$1',pair[1],pair[2]) INTO active USING value;
  IF active IS DISTINCT FROM true THEN RAISE EXCEPTION 'Related % record is missing or inactive',pair[1] USING ERRCODE='23514'; END IF;
 END LOOP;
 RETURN NEW;
END $$;
CREATE TRIGGER sales_parent BEFORE INSERT OR UPDATE ON sales FOR EACH ROW EXECUTE FUNCTION hope_check_parent('customer:custno:custno','employee:empno:empno');
CREATE TRIGGER salesdetail_parent BEFORE INSERT OR UPDATE ON salesdetail FOR EACH ROW EXECUTE FUNCTION hope_check_parent('sales:transno:transno','product:prodcode:prodcode');
CREATE TRIGGER payment_parent BEFORE INSERT OR UPDATE ON payment FOR EACH ROW EXECUTE FUNCTION hope_check_parent('sales:transno:transno');
CREATE TRIGGER pricehist_parent BEFORE INSERT OR UPDATE ON pricehist FOR EACH ROW EXECUTE FUNCTION hope_check_parent('product:prodcode:prodcode');
CREATE TRIGGER jobhistory_parent BEFORE INSERT OR UPDATE ON jobhistory FOR EACH ROW EXECUTE FUNCTION hope_check_parent('employee:empno:empno','job:jobcode:jobcode','department:deptcode:deptcode');

-- Keep session/token expiration cleanup independent of business soft-deletion.
CREATE FUNCTION hope_cleanup_expired() RETURNS void LANGUAGE sql SET search_path=public,pg_temp AS $$
 DELETE FROM app_session WHERE expires_at<now();
 DELETE FROM user_token WHERE expires_at<now()-interval '7 days';
$$;
REVOKE EXECUTE ON FUNCTION hope_cleanup_expired() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION hope_cleanup_expired() TO service_role;

INSERT INTO app_migration(version) VALUES('202611070001_hope_erp');
NOTIFY pgrst,'reload schema';
-- migrate:down
-- Forward-only: fail rather than falsely report a successful rollback.
DO $$ BEGIN RAISE EXCEPTION 'HOPE ERP migration is forward-only. Restore a database snapshot instead.'; END $$;
