const {test}=require('node:test');
const assert=require('node:assert/strict');
const session=require('express-session');
const createApp=require('../backend/src/app');
test('Reconciled repository serves one frontend and keeps reference source private',async t=>{
 const app=createApp({db:{},store:new session.MemoryStore(),sessionSecret:'repository-layout-test-secret-'.repeat(2),origins:[]});
 const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
 t.after(()=>new Promise(resolve=>server.close(resolve)));
 const base=`http://127.0.0.1:${server.address().port}`;
 for(const path of ['/.files/reference/main-990d7ba-source.zip','/.files/reference/main-990d7ba-manifest.json','/.documentation/team-main/sprint1-review-retrospective-report.md','/src/server.js','/backend/src/server.js','/database/migrations/20261107000100_hope_erp.sql','/.env']){
  const response=await fetch(base+path);assert.equal(response.status,404,path+' must not be public');
 }
 const response=await fetch(base+'/UI-UX/index.html');assert.equal(response.status,200);assert.match(await response.text(),/registration-verification/);
 const direct=await fetch(base+'/frontend/login/sign-in/index.html',{redirect:'manual'});assert.ok([301,302,307,308].includes(direct.status));assert.equal(direct.headers.get('location'),'/UI-UX/index.html');
});
