(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.HopeTableGroups=factory();})(typeof window!=='undefined'?window:this,function(){
  function valueFor(row,field){
    if(field==='employment')return row.sepdate?'Separated':'Employed';
    const value=row[field];
    if(value===null||value===undefined||value==='')return ['jobname','deptname'].includes(field)?'Unassigned':'Not set';
    if(typeof value==='boolean')return value?'Yes':'No';
    if(typeof value==='object')return JSON.stringify(value);
    const text=String(value);
    return /^\d{4}-\d{2}-\d{2}T/.test(text)?text.slice(0,10):text;
  }
  function groupRows(rows,field,descending=false){
    const buckets=new Map();
    rows.forEach((row,index)=>{const label=valueFor(row,field);if(!buckets.has(label))buckets.set(label,[]);buckets.get(label).push({row,index});});
    return [...buckets].sort(([a],[b])=>(descending?-1:1)*a.localeCompare(b,undefined,{numeric:true,sensitivity:'base'})).map(([label,entries])=>({label,entries}));
  }
  async function collectPages(first,loadNext,signal){
    const data=[...first.data];let count=first.count??data.length;
    while(data.length<count){
      if(signal?.aborted)throw new DOMException('Aborted','AbortError');
      const next=await loadNext(data.length);if(!next.data.length)break;
      data.push(...next.data);count=next.count??count;
    }
    return {...first,data,count};
  }
  return {valueFor,groupRows,collectPages};
});
