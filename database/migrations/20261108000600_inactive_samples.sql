-- migrate:up
-- User-requested inactive samples. Existing imported/live records are not changed.
DO $$
DECLARE n int; cust text; emp text; prod text; dept text; jobcode_value text; sale text; receipt text;
BEGIN
 IF EXISTS(SELECT 1 FROM app_migration WHERE version='202611080006_inactive_samples') THEN RAISE EXCEPTION 'Inactive samples already installed'; END IF;
 FOR n IN 1..5 LOOP
  cust:=hope_next_code('customer',NULL,true);
  emp:=hope_next_code('employee',NULL,true);
  prod:=hope_next_code('product','AD',true);
  dept:=hope_next_code('department','BR',true);
  jobcode_value:=hope_next_code('job','SA',true);
  sale:=hope_next_code('sales',NULL,true);
  receipt:=hope_next_code('payment',NULL,true);
  INSERT INTO customer(custno,custname,address,payterm,is_deleted) VALUES(cust,'Inactive sample '||n,'Sample archived address '||n,CASE WHEN n%2=0 THEN 'COD' ELSE '30D' END,true);
  INSERT INTO employee(empno,firstname,lastname,gender,hiredate,sepdate,is_deleted) VALUES(emp,'Sample','Inactive '||n,CASE WHEN n%2=0 THEN 'M' ELSE 'F' END,'2024-01-01','2025-12-31',true);
  INSERT INTO product(prodcode,description,unit,is_deleted) VALUES(prod,'Inactive sample product '||n,CASE WHEN n%2=0 THEN 'pc' ELSE 'ea' END,true);
  INSERT INTO department(deptcode,deptname,is_deleted) VALUES(dept,'Inactive dept '||n,true);
  INSERT INTO job(jobcode,jobdesc,is_deleted) VALUES(jobcode_value,'Inactive job '||n,true);
  INSERT INTO pricehist(effdate,prodcode,unitprice,is_deleted) VALUES('2025-01-01',prod,100+n*10,true);
  INSERT INTO jobhistory(empno,jobcode,effdate,salary,deptcode,is_deleted) VALUES(emp,jobcode_value,'2024-01-01',15000+n*1000,dept,true);
  INSERT INTO sales(transno,salesdate,custno,empno,is_deleted) VALUES(sale,'2025-02-01',cust,emp,true);
  INSERT INTO salesdetail(transno,prodcode,quantity,is_deleted) VALUES(sale,prod,n,true);
  INSERT INTO payment(orno,paydate,amount,transno,is_deleted) VALUES(receipt,'2025-02-02',n*50,sale,true);
  INSERT INTO users(email,name,role,status,is_deleted) VALUES('inactive.sample'||n||'@hope.example.invalid','Sample inactive user '||n,'user','blocked',true);
 END LOOP;
 INSERT INTO app_migration(version) VALUES('202611080006_inactive_samples');
END $$;
-- migrate:down
DO $$ BEGIN RAISE EXCEPTION 'Forward-only sample import'; END $$;
