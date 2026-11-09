const {test}=require('node:test');const assert=require('node:assert/strict');
const {valueFor,groupRows,collectPages}=require('../../frontend/shared/filters/table-groups');
test('table grouping preserves record-action indexes, totals and field semantics',()=>{
 const rows=[{id:1,payterm:'COD'},{id:2,payterm:'30D'},{id:3,payterm:'COD'},{id:4,payterm:null}];
 const groups=groupRows(rows,'payterm');
 assert.equal(groups.reduce((n,g)=>n+g.entries.length,0),4);
 const cod=groups.find(g=>g.label==='COD');assert.deepEqual(cod.entries.map(e=>e.index),[0,2]);assert.equal(cod.entries[1].row,rows[2]);
 assert.equal(valueFor({sepdate:null},'employment'),'Employed');assert.equal(valueFor({sepdate:'2025-01-01'},'employment'),'Separated');
 assert.equal(valueFor({action_at:'2026-11-08T10:00:00Z'},'action_at'),'2026-11-08');
 assert.deepEqual(groupRows([{n:2},{n:10},{n:1}],'n',true).map(g=>g.label),['10','2','1']);
});
test('grouping collects all matching pages rather than grouping just the first page',async()=>{
 const offsets=[];
 const result=await collectPages({data:[{id:1},{id:2}],count:5},async offset=>{offsets.push(offset);return {data:offset===2?[{id:3},{id:4}]:[{id:5}],count:5};});
 assert.deepEqual(offsets,[2,4]);assert.equal(result.data.length,5);
 const controller=new AbortController();controller.abort();
 await assert.rejects(collectPages({data:[],count:1},()=>{throw Error('must not fetch');},controller.signal),{name:'AbortError'});
});
