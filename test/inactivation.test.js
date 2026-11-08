const {test}=require('node:test'),assert=require('node:assert/strict'),bcrypt=require('bcryptjs');
const {createDatabase}=require('./helpers/database'),createApp=require('../src/app');
test('preview and atomic related-record inactivation',async t=>{
 const db=await createDatabase(),hash=await bcrypt.hash('Isolated-password-2026',4);
 const root=(await db.pg.query("INSERT INTO users(email,name,password_hash,role,status) VALUES('root@example.test','Root',$1,'superadmin','approved') RETURNING id",[hash])).rows[0].id;
 const member=(await db.pg.query("INSERT INTO users(email,name,password_hash,role,status,rights) VALUES('member@example.test','Member',$1,'user','approved',$2) RETURNING id",[hash,{'customers.view':true,'customers.delete':true}])).rows[0].id;
 await db.pg.exec(`INSERT INTO customer(custno,custname,payterm) VALUES('C0001','Parent','COD'),('C0002','Unrelated','COD');
 INSERT INTO employee(empno,firstname,lastname,hiredate) VALUES('00001','Test','Employee','2026-01-01');
 INSERT INTO department(deptcode,deptname) VALUES('DEP','Department'); INSERT INTO job(jobcode,jobdesc) VALUES('JOB','Job');
 INSERT INTO jobhistory(empno,jobcode,effdate,salary,deptcode) VALUES('00001','JOB','2026-01-01',1000,'DEP');
 INSERT INTO product(prodcode,description,unit) VALUES('PR0001','Product','pc'); INSERT INTO pricehist(prodcode,effdate,unitprice) VALUES('PR0001','2026-01-01',10);
 INSERT INTO sales(transno,salesdate,custno,empno) VALUES('TR000001','2026-02-01','C0001','00001');
 INSERT INTO salesdetail(transno,prodcode,quantity) VALUES('TR000001','PR0001',2);
 INSERT INTO payment(orno,paydate,amount,transno,is_deleted) VALUES('OR000001','2026-02-02',5,'TR000001',false),('OR000002','2026-02-02',1,'TR000001',true);`);
 const server=createApp({db,sessionSecret:'test-inactivation-only-'.repeat(3)}).listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));t.after(async()=>{await new Promise(r=>server.close(r));await db.pg.close();});
 const base='http://127.0.0.1:'+server.address().port,cookies={};
 async function req(who,method,path,body){const r=await fetch(base+path,{method,headers:{'content-type':'application/json',...(cookies[who]?{cookie:cookies[who]}:{})},body:body===undefined?undefined:JSON.stringify(body)});if(r.headers.get('set-cookie'))cookies[who]=r.headers.get('set-cookie').split(';')[0];return {status:r.status,body:await r.json()};}
 for(const who of ['root','member'])assert.equal((await req(who,'POST','/api/auth/login',{email:who+'@example.test',password:'Isolated-password-2026'})).status,200);
 let plan;
 await t.test('all ten tables preview only dependent records, never shared parents',async()=>{
  for(const [resource,key,size]of [['customers','C0001',4],['products','PR0001',3],['prices','2026-01-01~PR0001',1],['employees','00001',5],['departments','DEP',2],['jobs','JOB',2],['job-history','00001~JOB~2026-01-01',1],['sales','TR000001',3],['sale-details','TR000001~PR0001',1],['payments','OR000001',1]]){const r=await req('root','GET',`/api/${resource}/${key}/inactivation`);assert.equal(r.status,200,JSON.stringify(r));assert.equal(r.body.data.length,size,resource);}
  plan=(await req('root','GET','/api/customers/C0001/inactivation')).body.data;
  assert.deepEqual(plan.map(r=>r.table).sort(),['customer','payment','sales','salesdetail']);
 });
 await t.test('every affected table needs its own permission, including on commit',async()=>{
  assert.equal((await req('member','GET','/api/customers/C0001/inactivation')).status,403);
  assert.equal((await req('member','POST','/api/customers/C0001/inactivate',{plan})).status,403);
  assert.equal((await db.pg.query("SELECT is_deleted FROM customer WHERE custno='C0001'")).rows[0].is_deleted,false);
 });
 await t.test('new related rows invalidate confirmation and leave everything active',async()=>{
  await db.pg.exec("INSERT INTO payment(orno,paydate,amount,transno) VALUES('OR000003','2026-02-02',1,'TR000001')");
  assert.equal((await req('root','POST','/api/customers/C0001/inactivate',{plan})).status,409);
  assert.equal((await db.pg.query("SELECT is_deleted FROM customer WHERE custno='C0001'")).rows[0].is_deleted,false);
  plan=(await req('root','GET','/api/customers/C0001/inactivation')).body.data;
 });
 await t.test('confirmed group changes are atomic, audited and preserve rows/history',async()=>{
  const before=(await db.pg.query('SELECT count(*)::int n FROM audit_log')).rows[0].n;
  const r=await req('root','POST','/api/customers/C0001/inactivate',{plan});assert.equal(r.status,200,JSON.stringify(r));assert.equal(r.body.data.affected,5);
  for(const item of plan){const row=(await db.pg.query(`SELECT is_deleted FROM ${item.table} WHERE to_jsonb(${item.table}) @> $1`,[item.key])).rows[0];assert.equal(row.is_deleted,true);}
  assert.equal((await db.pg.query('SELECT count(*)::int n FROM audit_log')).rows[0].n,before+5);
  for(const [table,key]of [['customer',{custno:'C0002'}],['employee',{empno:'00001'}],['product',{prodcode:'PR0001'}]])assert.equal((await db.pg.query(`SELECT is_deleted FROM ${table} WHERE to_jsonb(${table}) @> $1`,[key])).rows[0].is_deleted,false);
  assert.equal((await db.pg.query('SELECT count(*)::int n FROM payment')).rows[0].n,3);
 });
 await t.test('restore respects active parents and leaves other inactive rows untouched',async()=>{
  assert.equal((await req('root','POST','/api/sales/TR000001/restore',{})).status,400);
  assert.equal((await req('root','POST','/api/customers/C0001/restore',{})).status,200);
  assert.equal((await db.pg.query("SELECT is_deleted FROM sales WHERE transno='TR000001'")).rows[0].is_deleted,true);
  assert.equal((await req('root','POST','/api/sales/TR000001/restore',{})).status,200);
 });
 await t.test('anonymous clients cannot call preview or commit RPCs',async()=>{await db.pg.exec('SET ROLE anon');try{await assert.rejects(db.pg.query('SELECT hope_inactivation_plan($1,$2,$3)',[root,'customer',{custno:'C0001'}]),/permission denied/);}finally{await db.pg.exec('RESET ROLE');}});
});
