const ui=require('../config/ui.json');
const {HttpError}=require('./http');
const quotedPattern=value=>JSON.stringify('%'+value.replace(/[\\%_]/g,'\\$&')+'%');
function scalar(value,label){if(typeof value!=='string'||value.length>200)throw new HttpError(400,'Invalid '+label);return value.trim();}
module.exports=function tableQuery(q,params,name,fields,pk,user){
 const textFields=fields.filter(k=>['text','select'].includes(ui.fields[k]?.[1])||['name','email','username','role','status','action','table_name','action_by','record_key'].includes(k));
 if(params.q!==undefined){const query=scalar(params.q,'search');if(query&&textFields.length)q=q.or(textFields.map(field=>`${field}.ilike.${quotedPattern(query)}`).join(','));}
 for(const filter of ui.tableFilters[name]||[]){
  const value=params['f_'+filter.field];
  if(value!==undefined&&value!==''){
   const v=scalar(value,'filter');
   if(filter.type==='select'){
    if(!filter.options.includes(v))throw new HttpError(400,'Unknown filter choice');
    if(filter.field==='employment')q=v==='employed'?q.is('sepdate',null):q.not('sepdate','is',null);
    else q=q.eq(filter.field,v);
   }else if(filter.type==='text')q=q.ilike(filter.field,'%'+v.replace(/[\\%_]/g,'\\$&')+'%');
  }
  if(['number','date'].includes(filter.type)){
   const values={};
   for(const [suffix,op]of [['from','gte'],['to','lte']]){
    const raw=params['f_'+filter.field+'_'+suffix];if(raw===undefined||raw==='')continue;
    const v=scalar(raw,'range');
    if(filter.type==='date'&&!/^\d{4}-\d{2}-\d{2}$/.test(v))throw new HttpError(400,'Use YYYY-MM-DD for date filters');
    if(filter.type==='number'&&(!/^-?\d+(\.\d+)?$/.test(v)||!Number.isFinite(Number(v))))throw new HttpError(400,'Enter a valid numeric range');
    values[suffix]=filter.type==='number'?Number(v):v;
    q=q[op](filter.field,v);
   }
   if(values.from!==undefined&&values.to!==undefined&&values.from>values.to)throw new HttpError(400,'Range start must not exceed its end');
  }
 }
 const sort=params.sort===undefined?pk[0]:scalar(params.sort,'sort column');
 const allowed=fields.filter(k=>!['rights','new_values','old_values'].includes(k));
 if(!allowed.includes(sort)||(['is_deleted','stamp'].includes(sort)&&user.role==='user'))throw new HttpError(400,'Unsupported sort column');
 const direction=params.direction||'asc';if(!['asc','desc'].includes(direction))throw new HttpError(400,'Use ascending or descending order');
 q=q.order(sort,{ascending:direction==='asc',nullsFirst:false});
 for(const key of pk)if(key!==sort)q=q.order(key,{ascending:true});
 return q;
};
