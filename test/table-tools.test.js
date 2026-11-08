const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');
const bcrypt=require('bcryptjs');const {createDatabase}=require('./helpers/database');const createApp=require('../src/app');
test('Table controls, inactive samples, and every Add endpoint',async t=>{
 const db=await createDatabase();const password='Table-tool-test-password';const hash=await bcrypt.hash(password,4);
 await db.pg.query("INSERT INTO users(email,name,role,status,password_hash) VALUES('tables@example.test','Table operator','superadmin','approved',$1)",[hash]);
 await db.pg.exec(fs.readFileSync('db/migrations/20261108000600_inactive_samples.sql','utf8').split('-- migrate:down')[0]);
 const server=createApp({db,sessionSecret:'table-tools-session-secret-'.repeat(3),origins:[]}).listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
 t.after(async()=>{await new Promise(r=>server.close(r));await db.pg.close();});const base='http://127.0.0.1:'+server.address().port;let cookie='';
 async function req(path,method='GET',body){const r=await fetch(base+path,{method,headers:{cookie,'content-type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});if(r.headers.get('set-cookie'))cookie=r.headers.get('set-cookie').split(';')[0];return {status:r.status,body:await r.json()};}
 await req('/api/auth/login','POST',{email:'tables@example.test',password});
 await t.test('five inactive rows per business table and five disabled sample accounts',async()=>{
  for(const name of ['customers','products','prices','employees','departments','jobs','job-history','sales','sale-details','payments']){const r=await req('/api/'+name+'?status=inactive');assert.equal(r.status,200,JSON.stringify(r));assert.equal(r.body.count,5,name);assert.ok(r.body.data.every(row=>row.is_deleted));}
  const users=await req('/api/admin/users?status=inactive&f_role=user&f_status=blocked&q=sample');assert.equal(users.body.count,5);assert.ok(users.body.data.every(r=>r.is_deleted&&r.status==='blocked'&&!r.password_hash));
 });
 await t.test('search and filters combine across all pages; counts precede pagination',async()=>{
  for(let n=0;n<65;n++)await db.pg.query('INSERT INTO customer(custno,custname,address,payterm) VALUES($1,$2,$3,$4)',['C'+String(200+n).padStart(4,'0'),n===64?'Target customer':'Customer '+String(n).padStart(2,'0'),'Test address',n%2?'COD':'30D']);
  const found=await req('/api/customers?q=Target&limit=10');assert.equal(found.body.count,1);assert.equal(found.body.data[0].custno,'C0264');
  const filtered=await req('/api/customers?q=Customer&f_payterm=COD&sort=custno&direction=desc&limit=2');assert.equal(filtered.body.count,32);assert.deepEqual(filtered.body.data.map(r=>r.custno),['C0263','C0261']);
  const second=await req('/api/customers?q=Customer&f_payterm=COD&sort=custno&direction=desc&limit=2&offset=2');assert.deepEqual(second.body.data.map(r=>r.custno),['C0259','C0257']);
  const quoted=await req('/api/customers?q='+encodeURIComponent('x,role.eq.superadmin)'));assert.equal(quoted.status,200);assert.equal(quoted.body.count,0);
 });
 await t.test('numeric, date, employment and status filters use table-specific types',async()=>{
  const prices=await req('/api/prices?status=inactive&f_unitprice_from=120&f_unitprice_to=140&q=AD&sort=unitprice&direction=desc');assert.equal(prices.status,200,JSON.stringify(prices));assert.equal(prices.body.count,3);assert.deepEqual(prices.body.data.map(r=>Number(r.unitprice)),[140,130,120]);
  const staff=await req('/api/employees?status=inactive&f_employment=separated&f_hiredate_from=2024-01-01&f_hiredate_to=2024-12-31');assert.equal(staff.status,200,JSON.stringify(staff));assert.equal(staff.body.count,5);
  assert.equal((await req('/api/prices?f_unitprice_from=200&f_unitprice_to=100')).status,400);
  assert.equal((await req('/api/customers?sort=password_hash')).status,400);
  assert.equal((await req('/api/customers?direction=sideways')).status,400);
 });
 await t.test('all business Add routes save generated IDs, relationships, and pending accounts',async()=>{
  async function add(resource,payload){const r=await req('/api/'+resource,'POST',payload);assert.equal(r.status,201,resource+': '+JSON.stringify(r));return r.body.data;}
  const customer=await add('customers',{custname:'Added customer',address:'Test',payterm:'COD'});
  const product=await add('products',{description:'Added product',unit:'ea',_code_prefix:'AD'});
  const employee=await add('employees',{firstname:'Added',lastname:'Employee',hiredate:'2026-01-01'});
  const dept=await add('departments',{deptname:'Added department',_code_prefix:'BR'});
  const job=await add('jobs',{jobdesc:'Added job',_code_prefix:'SA'});
  await add('prices',{prodcode:product.prodcode,effdate:'2026-01-01',unitprice:100});
  await add('job-history',{empno:employee.empno,jobcode:job.jobcode,deptcode:dept.deptcode,effdate:'2026-01-01',salary:20000});
  const sale=await add('sales',{custno:customer.custno,empno:employee.empno,salesdate:'2026-11-08',lines:[{prodcode:product.prodcode,quantity:2}]});
  const other=await add('products',{description:'Second product',unit:'pc',_code_prefix:'AD'});await add('prices',{prodcode:other.prodcode,effdate:'2026-01-01',unitprice:50});
  await add('sale-details',{transno:sale.transno,prodcode:other.prodcode,quantity:1});
  await add('payments',{transno:sale.transno,paydate:'2026-11-08',amount:100});
  const user=await req('/api/admin/users','POST',{name:'Added User',email:'added-user@example.test',role:'user'});assert.equal(user.status,201,JSON.stringify(user));assert.equal(user.body.data.status,'pending');
  assert.ok(/^C\d{4}$/.test(customer.custno));assert.ok(/^\d{5}$/.test(employee.empno));assert.ok(/^TR\d{6}$/.test(sale.transno));
 });
 await t.test('ordinary users cannot retrieve inactive rows or use system sort columns',async()=>{
  await db.pg.query(`INSERT INTO users(email,name,role,status,password_hash,rights) VALUES('limited-table@example.test','Limited','user','approved',$1,'{"customers.view":true}')`,[hash]);
  await req('/api/auth/login','POST',{email:'limited-table@example.test',password});
  const r=await req('/api/customers?status=inactive&q=customer');assert.equal(r.status,200,JSON.stringify(r));assert.ok(r.body.data.every(row=>!('is_deleted' in row)));assert.ok(!r.body.data.some(row=>row.custname.startsWith('Inactive')));
  assert.equal((await req('/api/customers?sort=stamp')).status,400);
  assert.equal((await req('/api/admin/users?status=inactive')).status,403);
 });
});
