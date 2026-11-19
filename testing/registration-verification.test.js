const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createDatabase}=require('./helpers/database');
const createApp=require('../backend/src/app');
test('Registration email proof gates approval and consumes codes once',async t=>{
 const db=await createDatabase(), messages=[];
 let fail=false;
 const app=createApp({db,sessionSecret:'registration-test-secret-'.repeat(3),origins:[],registrationMailer:async m=>{if(fail)throw Error('delivery');messages.push(m);}});
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
 t.after(async()=>{await new Promise(r=>server.close(r));await db.pg.close();});
 let cookie='';
 async function post(path,body,own=true){const r=await fetch(`http://127.0.0.1:${server.address().port}/api/auth/${path}`,{method:'POST',headers:{'content-type':'application/json',cookie:own?cookie:''},body:JSON.stringify(body)});if(own&&r.headers.get('set-cookie'))cookie=r.headers.get('set-cookie').split(';')[0];return {status:r.status,body:await r.json()};}
 const details={name:'Email Owner',username:'owner',email:'owner@example.test',password:'Strong-password-123',role:'superadmin',status:'approved'};
 assert.equal((await post('register',details)).status,202);
 assert.equal((await db.pg.query("SELECT count(*)::int n FROM users")).rows[0].n,0);
 let code=messages.at(-1).text.match(/code is (\d{6})/)[1];
 assert.equal((await post('verify-registration-code',{code},false)).status,400);
 assert.equal((await post('verify-registration-code',{code:'12345x'})).status,400);
 assert.equal((await post('resend-registration-code',{})).status,429);
 await db.pg.exec("UPDATE registration_challenge SET created_at=now()-interval '61 seconds'");
 assert.equal((await post('resend-registration-code',{})).status,202);
 const newCode=messages.at(-1).text.match(/code is (\d{6})/)[1];
 const wrong=newCode==='000000'?'000001':'000000';
 assert.equal((await post('verify-registration-code',{code:wrong})).status,400);
 const verified=await post('verify-registration-code',{code:newCode});assert.equal(verified.status,201);assert.equal(verified.body.data.role,'user');assert.equal(verified.body.data.status,'pending');
 assert.equal((await post('verify-registration-code',{code:newCode})).status,400);
 const consumed=(await db.pg.query('SELECT * FROM registration_challenge')).rows[0];assert.equal(consumed.code_hash,null);assert.equal(consumed.password_hash,null);
 fail=true;assert.equal((await post('register',{...details,username:'second',email:'second@example.test'})).status,503);
 assert.equal((await db.pg.query("SELECT count(*)::int n FROM users")).rows[0].n,1);
 fail=false;assert.equal((await post('register',{...details,username:'third',email:'third@example.test'})).status,202);
 await db.pg.exec("UPDATE registration_challenge SET expires_at=now()-interval '1 second' WHERE email='third@example.test'");
 code=messages.at(-1).text.match(/code is (\d{6})/)[1];assert.equal((await post('verify-registration-code',{code})).status,400);
 const draft=(await db.pg.query("SELECT id,code_hash FROM registration_challenge WHERE email='third@example.test'")).rows[0];
 await db.pg.query("UPDATE registration_challenge SET expires_at=now()+interval '10 minutes' WHERE id=$1",[draft.id]);
 for(let i=0;i<5;i++) assert.equal((await db.rpc('hope_confirm_registration',{p_id:draft.id,p_code:'wrong-hash'})).data,null);
 assert.equal((await db.rpc('hope_confirm_registration',{p_id:draft.id,p_code:draft.code_hash})).data,null);
 assert.equal((await db.pg.query("SELECT count(*)::int n FROM users")).rows[0].n,1);
 await db.pg.exec('SET ROLE anon');try{await assert.rejects(db.pg.query('SELECT * FROM registration_challenge'),/permission denied/);}finally{await db.pg.exec('RESET ROLE');}
});
