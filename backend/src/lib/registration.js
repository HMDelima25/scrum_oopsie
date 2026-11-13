const crypto = require('node:crypto');
const {check,HttpError,object}=require('./http');
const {createMailer}=require('./mailer');
const digest=(req,id,code)=>crypto.createHmac('sha256',req.app.locals.recoverySecret).update(`${id}:${code}`).digest('hex');
async function issue(req,res,row) {
 const id=crypto.randomUUID(), code=String(crypto.randomInt(1000000)).padStart(6,'0');
 const staged=check(await req.app.locals.db.rpc('hope_stage_registration',{p_id:id,p_email:row.email,p_name:row.name,p_username:row.username||null,p_password:row.password_hash,p_code:digest(req,id,code)}));
 if(!staged) throw new HttpError(429,'Wait 60 seconds before requesting another code.');
 req.session.registrationId=id;
 await new Promise((resolve,reject)=>req.session.save(e=>e?reject(e):resolve()));
 try {
  const mail=req.app.locals.registrationMailer||createMailer();
  await mail({to:row.email,subject:'Verify your HOPE account',text:`Your HOPE verification code is ${code}. It expires in 10 minutes and can be used once. Your account will require Superadmin approval after verification. If you did not request this, ignore this email.`});
 } catch {
  check(await req.app.locals.db.from('registration_challenge').update({used_at:new Date().toISOString(),password_hash:null,code_hash:null}).eq('id',id));
  delete req.session.registrationId;
  throw new HttpError(503,'We could not send the verification code. Please try again later.');
 }
 res.status(202).json({status:'verification_required',message:'Enter the six-digit code sent to your email. Verify it before submitting your account for approval.',retryAfter:60});
}
async function resend(req,res) {
 const row=check(await req.app.locals.db.from('registration_challenge').select('*').eq('id',req.session.registrationId||'00000000-0000-0000-0000-000000000000').maybeSingle());
 if(!row||row.used_at||!row.password_hash) throw new HttpError(400,'Start account creation again to request a code.');
 await issue(req,res,row);
}
async function verify(req,res) {
 const b=object(req.body);
 if(typeof b.code!=='string'||!/^\d{6}$/.test(b.code)) throw new HttpError(400,'Enter the six-digit code from your email.');
 if(!req.session.registrationId) throw new HttpError(400,'Start account creation before verifying your email.');
 const data=check(await req.app.locals.db.rpc('hope_confirm_registration',{p_id:req.session.registrationId,p_code:digest(req,req.session.registrationId,b.code)}));
 if(!data) throw new HttpError(400,'The code is incorrect, expired or has reached its attempt limit. Request another code.');
 delete req.session.registrationId;
 res.status(201).json({status:'success',message:'Email verified. Your account is awaiting Superadmin approval.',data});
}
module.exports={issue,resend,verify};
