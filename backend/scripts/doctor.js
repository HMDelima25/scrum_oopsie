// Read-only setup checks. Never print credential values or account records.
require('dotenv').config({quiet:true});
const fs=require('node:fs');
async function main(){
 let failed=false;
 const report=(ok,label,help)=>{console.log(`${ok?'OK':'FIX'}: ${label}${!ok&&help?' — '+help:''}`);if(!ok)failed=true;};
 report(Number(process.versions.node.split('.')[0])>=22,'Node.js version','Install Node.js 22 or later.');
 report(fs.existsSync('.env'),'Private .env file','Copy .env.example to .env in the repository root and configure it privately.');
 const key=process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY;
 const configured=Boolean(process.env.SUPABASE_URL&&key&&!/server-only-key-from|paste|replace-with/i.test(key));
 report(configured,'Supabase server configuration','Set the real SUPABASE_URL and server-only SUPABASE_SECRET_KEY (or SUPABASE_SERVICE_ROLE_KEY). The example key is a placeholder.');
 report(Boolean(process.env.SESSION_SECRET&&process.env.SESSION_SECRET.length>=32&&!/replace-with/i.test(process.env.SESSION_SECRET)),'Session secret','Use a private random SESSION_SECRET of at least 32 characters.');
 if(configured){
  const db=require('../src/config/supabase')();
  for(const [table,columns] of [['users','id,username,password_hash,auth_version'],['app_session','sid,expires_at'],['login_activity','id,logged_in_at']]){
   const {error}=await db.from(table).select(columns).limit(1);
   const hint=error?.code==='42501'?'This key cannot access server tables. Use a server-only secret/service-role key, not an anon or publishable key.':error?.code==='PGRST205'||error?.code==='PGRST204'?'This database is missing the fork’s schema or columns. Use the configured HOPE project or apply its matching migrations.':error?.code==='PGRST301'||error?.code==='PGRST303'?'The Supabase key is invalid or expired. Replace it privately.':'Check the project URL, key, network connection and Supabase project status.';
   report(!error,`${table} database access`,hint);
  }
 }
 console.log(failed?'Setup needs attention. Fix the items above, then restart npm start.':'Required login configuration checks passed. Run npm start and open http://localhost:5000/UI-UX/index.html.');
 process.exitCode=failed?1:0;
}
main().catch(()=>{console.error('FIX: Could not complete setup checks. Check the configuration and network connection.');process.exitCode=1;});
