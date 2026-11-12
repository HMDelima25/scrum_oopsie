const {test}=require('node:test');const assert=require('node:assert/strict');const bcrypt=require('bcryptjs');
const {createDatabase}=require('./helpers/database');const createApp=require('../backend/src/app');
test('Username, email and Google authentication guards',async t=>{
 const db=await createDatabase();
 const admin=(await db.pg.query(`INSERT INTO users(username,email,name,role,status,password_hash) VALUES('admin',NULL,'Administrator','admin','approved',$1) RETURNING id`,[await bcrypt.hash('admin123',4)])).rows[0];
 const messages=[];
 const app=createApp({registrationMailer:async m=>messages.push(m),db,sessionSecret:'account-tests-private-secret-'.repeat(2),origins:[]});const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
 t.after(async()=>{await new Promise(r=>server.close(r));await db.pg.close();});const base='http://127.0.0.1:'+server.address().port;let cookie='';
 async function req(path,method='GET',body){const response=await fetch(base+path,{method,redirect:'manual',headers:{'content-type':'application/json',cookie},body:body===undefined?undefined:JSON.stringify(body)});if(response.headers.get('set-cookie'))cookie=response.headers.get('set-cookie').split(';')[0];const text=await response.text();let data;try{data=JSON.parse(text);}catch{data=text;}return{status:response.status,data,location:response.headers.get('location')};}
 await t.test('empty or incorrect credentials never create a session',async()=>{
  assert.equal((await req('/api/auth/login','POST',{})).status,400);
  assert.equal((await req('/api/auth/login','POST',{identifier:'admin',password:'incorrect'})).status,401);
  assert.equal((await req('/api/auth/me')).status,401);
 });
 await t.test('login identifies the field for missing accounts and incorrect passwords',async()=>{
  const email=await req('/api/auth/login','POST',{identifier:'missing@example.test',password:'incorrect'});assert.equal(email.status,401);assert.equal(email.data.field,'identifier');assert.match(email.data.message,/email does not exist/);
  const username=await req('/api/auth/login','POST',{identifier:'missing-user',password:'incorrect'});assert.equal(username.status,401);assert.equal(username.data.field,'identifier');assert.match(username.data.message,/username does not exist/);
  const pass=await req('/api/auth/login','POST',{identifier:'admin',password:'incorrect'});assert.equal(pass.status,401);assert.equal(pass.data.field,'password');assert.match(pass.data.message,/password is incorrect/);
 });
 await t.test('weak new passwords are rejected by registration without creating an account',async()=>{
  const r=await req('/api/auth/register','POST',{name:'Weak',username:'weak-user',email:'weak@example.test',password:'A-long-password'});assert.equal(r.status,400);assert.equal(r.data.field,'password');assert.equal((await db.pg.query("SELECT count(*)::int n FROM users WHERE username='weak-user'")).rows[0].n,0);
 });
 await t.test('requested Admin credentials work through actual password verification',async()=>{
  assert.equal((await req('/api/auth/login','POST',{identifier:'ADMIN',password:'admin123'})).status,200);
  const me=await req('/api/auth/me');assert.equal(me.data.data.id,admin.id);assert.equal(me.data.data.username,'admin');assert.equal(me.data.data.role,'admin');
  await req('/api/auth/logout','POST',{});assert.equal((await req('/api/auth/me')).status,401);
 });
 await t.test('registration persists username and password but never public Admin privileges',async()=>{
  let r=await req('/api/auth/register','POST',{firstName:'Account',lastName:'Test',username:'new-user',email:'new@example.test',password:'A-real-test-password-1',role:'admin',status:'approved'});
  assert.equal(r.status,202);
  assert.equal((await db.pg.query("SELECT count(*)::int n FROM users WHERE username='new-user'")).rows[0].n,0);
  r=await req('/api/auth/verify-registration-code','POST',{code:messages.at(-1).text.match(/code is (\d{6})/)[1]});
  assert.equal(r.status,201);assert.equal(r.data.data.username,'new-user');assert.equal(r.data.data.status,'pending');assert.equal(r.data.data.role,'user');
  const row=(await db.pg.query(`SELECT * FROM users WHERE username='new-user'`)).rows[0];assert.ok(await bcrypt.compare('A-real-test-password-1',row.password_hash));assert.equal(r.data.data.password_hash,undefined);
  assert.equal((await req('/api/auth/login','POST',{identifier:'new-user',password:'A-real-test-password-1'})).status,403);
  await db.pg.query(`UPDATE users SET status='approved' WHERE username='new-user'`);
  assert.equal((await req('/api/auth/login','POST',{email:'new@example.test',password:'A-real-test-password-1'})).status,200);
 });
 await t.test('duplicate usernames and malformed usernames are rejected',async()=>{
  const b={name:'Duplicate',email:'other@example.test',username:'new-user',password:'A-real-test-password-1'};
  assert.equal((await req('/api/auth/register','POST',b)).status,409);b.username='bad@name';assert.equal((await req('/api/auth/register','POST',b)).status,400);
 });
 await t.test('Google callback cannot log in using an unverified or client-supplied code',async()=>{
  await req('/api/auth/logout','POST',{});
  const r=await req('/api/auth/google/callback?code=forged-code');assert.equal(r.status,302);assert.match(r.location,/authMessage=/);assert.ok(!r.location.includes('dashboard'));
  assert.equal((await req('/api/auth/me')).status,401);
 });
 await t.test('Google identities are private and links do not auto-grant application approval',async()=>{
  const row=(await db.pg.query(`SELECT id,status FROM users WHERE username='new-user'`)).rows[0];
  const linked=await db.rpc('hope_attach_identity',{p_user:row.id,p_subject:'verified-provider-subject'});assert.equal(linked.error,null);
  const state=(await db.pg.query('SELECT role,status FROM users WHERE id=$1',[row.id])).rows[0];assert.equal(state.role,'user');
  await db.pg.exec('SET ROLE anon');try{await assert.rejects(db.pg.query('SELECT * FROM auth_identity'),/permission denied/);}finally{await db.pg.exec('RESET ROLE');}
 });
});
