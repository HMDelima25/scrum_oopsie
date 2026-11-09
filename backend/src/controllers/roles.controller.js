const {check,HttpError,text,object}=require('../lib/http');
const {normalizeRights}=require('../lib/permissions');
const columns='id,name,description,rights,status,created_at,updated_at';
function expected(req){if(!req.get('if-match'))return null;let value;try{value=JSON.parse(req.get('if-match'));}catch{throw new HttpError(400,'Invalid role version.');}if(typeof value!=='string'||!Number.isFinite(Date.parse(value)))throw new HttpError(400,'Invalid role version.');return value;}
async function list(req,res){
 let q=req.app.locals.db.from('permission_role').select(columns,{count:'exact'});
 const status=req.query.status||'active';if(!['active','inactive','all'].includes(status))throw new HttpError(400,'Unknown role status.');if(status!=='all')q=q.eq('status',status);
 q=require('../lib/table-query')(q,req.query,'roles',['id','name','description','status','created_at','updated_at'],['id'],req.user);
 const limit=Math.min(200,Math.max(1,parseInt(req.query.limit)||50)),offset=Math.max(0,parseInt(req.query.offset)||0);
 const result=await q.range(offset,offset+limit-1),rows=check(result);
 const ids=rows.map(r=>r.id);const members=ids.length?check(await req.app.locals.db.from('users').select('id,permission_role_id').in('permission_role_id',ids).eq('is_deleted',false).eq('status','approved')):[];
 for(const row of rows){row.members=members.filter(u=>u.permission_role_id===row.id).length;row.permission_count=Object.values(row.rights).filter(v=>v===true).length;}
 res.json({status:'success',data:rows,count:result.count,limit,offset});
}
async function get(req,res){const row=check(await req.app.locals.db.from('permission_role').select(columns).eq('id',req.params.id).maybeSingle());if(!row)throw new HttpError(404,'Role not found.');res.json({status:'success',data:row});}
async function save(req,res){
 const b=object(req.body),data={};
 for(const key of Object.keys(b))if(!['name','description','rights','status'].includes(key))throw new HttpError(400,'Unsupported role field: '+key);
 if(!req.params.id||b.name!==undefined)data.name=text(b.name,'Role name',80);
 if(b.description!==undefined){if(typeof b.description!=='string'||b.description.length>500)throw new HttpError(400,'Description must be at most 500 characters.');data.description=b.description.trim();}
 if(b.rights!==undefined)data.rights=normalizeRights(b.rights);
 if(b.status!==undefined){if(!['active','inactive'].includes(b.status))throw new HttpError(400,'Choose active or inactive.');data.status=b.status;}
 const row=check(await req.app.locals.db.rpc('hope_save_permission_role',{p_actor:req.user.id,p_id:req.params.id||null,p_data:data,p_expected:expected(req)}));
 res.status(req.params.id?200:201).json({status:'success',data:row});
}
async function assign(req,res){const b=object(req.body);if(Object.keys(b).some(k=>k!=='permission_role_id'))throw new HttpError(400,'Unsupported assignment field.');if(b.permission_role_id!==null&&typeof b.permission_role_id!=='string')throw new HttpError(400,'Choose a role or Custom permissions.');const row=check(await req.app.locals.db.rpc('hope_assign_permission_role',{p_actor:req.user.id,p_user:req.params.id,p_role:b.permission_role_id,p_expected:expected(req)}));const {password_hash,reset_token,reset_token_expires,...safe}=row;res.json({status:'success',data:safe});}
module.exports={list,get,save,assign};
