const {test}=require('node:test');
const assert=require('node:assert/strict');
const bcrypt=require('bcryptjs');
const {createDatabase}=require('./helpers/database');
const createApp=require('../src/app');
const resources=require('../src/config/resources');
const catalogue=require('../src/config/rights.json');
test('permission catalogue and named roles enforce real requests',async t=>{
 const db=await createDatabase(),password='Role-verification-2026',hash=await bcrypt.hash(password,4),ids={};
 for(const [name,role,status] of [['root','superadmin','approved'],['manager','admin','approved'],['member','user','approved'],['pending','user','pending']])ids[name]=(await db.pg.query('INSERT INTO users(email,name,password_hash,role,status) VALUES($1,$2,$3,$4,$5) RETURNING id',[name+'@example.test',name,hash,role,status])).rows[0].id;
 const server=createApp({db,sessionSecret:'role-test-only-secret-'.repeat(3)}).listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));t.after(async()=>{await new Promise(r=>server.close(r));await db.pg.close();});
 const cookies={},base='http://127.0.0.1:'+server.address().port;
 async function request(who,method,path,body,headers={}){const response=await fetch(base+path,{method,headers:{'content-type':'application/json',...(cookies[who]?{cookie:cookies[who]}:{}),...headers},body:body===undefined?undefined:JSON.stringify(body)});if(response.headers.get('set-cookie'))cookies[who]=response.headers.get('set-cookie').split(';')[0];return {status:response.status,body:await response.json()};}
 for(const who of ['root','manager','member'])assert.equal((await request(who,'POST','/api/auth/login',{email:who+'@example.test',password})).status,200);
 const all=Object.fromEntries(Object.keys(catalogue).map(k=>[k,true]));
 const grant=async rights=>{const r=await request('root','PUT',`/api/admin/users/${ids.member}/rights`,{rights});assert.equal(r.status,200,JSON.stringify(r));};
 let seq=0;
 async function insert(resource){const c=resources[resource],payload=await values(resource),cols=Object.keys(payload);await db.pg.query(`INSERT INTO ${c.table}(${cols.join(',')}) VALUES(${cols.map((_,i)=>'$'+(i+1)).join(',')})`,Object.values(payload));return payload;}
 async function values(resource){const n=String(++seq).padStart(4,'0');switch(resource){
 case 'customers':return {custno:'M'+n,custname:'Matrix '+n,address:'Test',payterm:'COD'};
 case 'products':return {prodcode:'MX'+n,description:'Matrix '+n,unit:'pc'};
 case 'employees':return {empno:'M'+n,firstname:'Test',lastname:'Member',hiredate:'2026-01-01'};
 case 'departments':return {deptcode:'D'+n.slice(-2),deptname:'Matrix '+n};
 case 'jobs':return {jobcode:'J'+n.slice(-3),jobdesc:'Matrix '+n};
 case 'prices':return {prodcode:(await insert('products')).prodcode,effdate:'2026-01-01',unitprice:10};
 case 'job-history':return {empno:(await insert('employees')).empno,jobcode:(await insert('jobs')).jobcode,deptcode:(await insert('departments')).deptcode,effdate:'2026-01-01',salary:1000};
 case 'sales':return {transno:'MT'+n.padStart(6,'0'),salesdate:'2026-02-01',custno:(await insert('customers')).custno,empno:(await insert('employees')).empno};
 case 'sale-details':return {transno:(await insert('sales')).transno,prodcode:(await insert('prices')).prodcode,quantity:2};
 case 'payments':return {orno:'MO'+n.padStart(6,'0'),transno:(await insert('sales')).transno,paydate:'2026-02-02',amount:0};
 }}
 const edits={customers:{address:'Edited'},products:{description:'Edited'},prices:{unitprice:11},employees:{firstname:'Edited'},departments:{deptname:'Edited'},jobs:{jobdesc:'Edited'},'job-history':{salary:1100},sales:{salesdate:'2026-02-02'},'sale-details':{quantity:3},payments:{amount:0}};
 const exercised=new Set();
 for(const [resource,c] of Object.entries(resources)){
  for(let i=0;i<3;i++)await t.test(`${c.module}.${c.actions[i]} denies then permits ${resource} ${['create','edit','delete'][i]}`,async()=>{
   const permission=c.module+'.'+c.actions[i];exercised.add(permission);let body,key='',method=['POST','PATCH','DELETE'][i];
   if(i===0){body=await values(resource);if(resource==='jobs'){delete body.jobcode;body.jobname=body.jobdesc;body.deptcode=(await insert('departments')).deptcode;}if(resource==='sales'){delete body.transno;body.lines=[{prodcode:(await insert('prices')).prodcode,quantity:2}];}}
   else {const row=await insert(resource);key='/'+c.pk.map(k=>row[k]).join('~');if(i===1)body=edits[resource];}
   await grant({...all,[permission]:false});assert.equal((await request('member',method,'/api/'+resource+key,body)).status,403);
   await grant(all);const allowed=await request('member',method,'/api/'+resource+key,body);assert.equal(allowed.status,i===0?201:200,JSON.stringify(allowed));
  });
 }
 for(const [permission,path] of Object.entries({'customers.view':'customers','products.view':'products','hr.view':'employees','sales.view':'sales','hr.jhView':'job-history','sales.detailView':'sale-details','reports.view':'reports/top-sales',...Object.fromEntries(Object.entries({'topCustomers':'top-customers','productMaster':'product-master-list','topProducts':'top-products','activeEmployees':'active-employees','allEmployees':'all-employees','empJobHistory':'employee-job-history?employee=M0001','topSales':'top-sales'}).map(([k,v])=>['reports.'+k,'reports/'+v]))}))await t.test(permission+' denies then permits reading',async()=>{exercised.add(permission);await grant({...all,[permission]:false});assert.equal((await request('member','GET','/api/'+path)).status,403);await grant(all);const r=await request('member','GET','/api/'+path);assert.equal(r.status,200,JSON.stringify(r));});
 await t.test('all 41 catalogue entries exercised on real protected endpoints',()=>assert.deepEqual([...exercised].sort(),Object.keys(catalogue).sort()));
 let role;
 await t.test('create, assign and edit a role updates existing signed-in members',async()=>{
  const r=await request('root','POST','/api/admin/roles',{name:'Customer clerk',description:'Isolated test',rights:{'customers.view':true,'customers.add':true}});assert.equal(r.status,201,JSON.stringify(r));role=r.body.data;
  let assigned=await request('manager','PUT',`/api/admin/users/${ids.member}/permission-role`,{permission_role_id:role.id});assert.equal(assigned.status,200,JSON.stringify(assigned));assert.equal(assigned.body.data.role,'user');assert.equal(assigned.body.data.status,'approved');
  assert.equal((await request('member','GET','/api/customers')).status,200);assert.equal((await request('member','GET','/api/products')).status,403);
  let changed=await request('root','PUT','/api/admin/roles/'+role.id,{rights:all},{'if-match':JSON.stringify(role.updated_at)});assert.equal(changed.status,200,JSON.stringify(changed));assert.deepEqual(changed.body.data.rights,all);role=changed.body.data;
  assert.equal((await request('member','GET','/api/products')).status,200);
  const mirror=(await db.pg.query('SELECT rights,permission_role_id FROM users WHERE id=$1',[ids.member])).rows[0];assert.deepEqual(mirror.rights,all);assert.equal(mirror.permission_role_id,role.id);
  assert.equal((await db.pg.query('SELECT count(*)::int n FROM user_permission WHERE user_id=$1 AND allowed',[ids.member])).rows[0].n,41);
  assert.equal((await request('root','PUT',`/api/admin/users/${ids.member}/permission-role`,{permission_role_id:null},{'if-match':JSON.stringify('2000-01-01T00:00:00Z')})).status,409);
  assert.equal((await request('root','GET','/api/admin/roles/'+role.id)).body.data.name,'Customer clerk');
 });
 await t.test('deactivate revokes all grants, reactivation restores them, custom overrides detach',async()=>{
  assert.equal((await request('root','PUT','/api/admin/roles/'+role.id,{status:'inactive'})).status,200);assert.equal((await request('member','GET','/api/customers')).status,403);
  assert.equal((await request('root','PUT',`/api/admin/users/${ids.member}/permission-role`,{permission_role_id:role.id})).status,400);
  assert.equal((await request('root','PUT','/api/admin/roles/'+role.id,{status:'active'})).status,200);assert.equal((await request('member','GET','/api/customers')).status,200);
  await grant({'customers.view':true});assert.equal((await db.pg.query('SELECT permission_role_id FROM users WHERE id=$1',[ids.member])).rows[0].permission_role_id,null);
  await request('root','PUT','/api/admin/roles/'+role.id,{rights:{'products.view':true}});assert.equal((await request('member','GET','/api/customers')).status,200);assert.equal((await request('member','GET','/api/products')).status,403);
 });
 await t.test('pending approval, hierarchy and role creation boundaries cannot be bypassed',async()=>{
  assert.equal((await request('manager','PUT',`/api/admin/users/${ids.pending}/permission-role`,{permission_role_id:role.id})).status,200);
  assert.equal((await request('pending','POST','/api/auth/login',{email:'pending@example.test',password})).status,403);
  assert.equal((await request('manager','PATCH',`/api/admin/users/${ids.pending}/status`,{status:'blocked'})).status,200);
  assert.equal((await request('manager','PATCH',`/api/admin/users/${ids.pending}/status`,{status:'approved'})).status,403);
  for(const target of ['root','manager'])assert.equal((await request('root','PUT',`/api/admin/users/${ids[target]}/permission-role`,{permission_role_id:role.id})).status,403);
  assert.equal((await request('member','POST','/api/admin/roles',{name:'Escalation',rights:all})).status,403);
 });
 await t.test('invalid, duplicate and stale changes fail; parent gates clear child permissions',async()=>{
  assert.equal((await request('root','POST','/api/admin/roles',{name:'CUSTOMER CLERK'})).status,409);
  for(const payload of [{name:'Admin'},{name:'bad',rights:{'customers.add':'yes'}},{name:'bad',rights:{'settings.edit':true}},{name:'bad',role:'superadmin'}])assert.equal((await request('root','POST','/api/admin/roles',payload)).status,400);
  assert.equal((await request('root','PUT','/api/admin/roles/'+role.id,{name:'Changed'},{'if-match':JSON.stringify('2000-01-01T00:00:00Z')})).status,409);
  assert.equal((await request('root','POST','/api/admin/roles',{name:'Invalid prototype key',rights:JSON.parse('{"toString":true}')})).status,400);
  const r=await request('root','PUT','/api/admin/roles/'+role.id,{rights:{'customers.view':false,'customers.add':true}});assert.equal(r.body.data.rights['customers.add'],false);
  assert.ok((await db.pg.query("SELECT count(*)::int n FROM audit_log WHERE table_name='permission_role'")).rows[0].n>=5);
 });
 await t.test('anonymous database access and privileged role RPC calls denied',async()=>{await db.pg.exec('SET ROLE anon');try{await assert.rejects(db.pg.query('SELECT * FROM permission_role'),/permission denied/);await assert.rejects(db.pg.query('SELECT hope_save_permission_role($1,NULL,$2,NULL)',[ids.root,{name:'forged'}]),/permission denied/);}finally{await db.pg.exec('RESET ROLE');}});
});

