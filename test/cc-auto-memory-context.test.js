const test=require("node:test");const assert=require("node:assert/strict");
test("自动上下文只选择言秋关联记忆，并优先置顶与未了",async()=>{
  const M=await import("../scripts/cc-auto-memory-context.mjs");
  const rows=[
    {id:"other",text:"别人的秘密",char_ids:["other"],ts:99},
    {id:"recent",text:"近期",char_ids:["yan"],ts:30},
    {id:"open",text:"未了",char_ids:["yan"],ts:10,open:true},
    {id:"pin",text:"置顶",char_ids:["yan"],ts:1,pinned:true},
    {id:"deleted",text:"删除",char_ids:["yan"],ts:50,deleted:true}
  ];
  const got=M.selectMemoryContext(rows,"yan",{pinned:1,open:1,recent:1});
  assert.deepEqual(got.map(x=>x.id),["pin","open","recent"]);
  assert.equal(got.some(x=>x.id==="other"||x.id==="deleted"),false);
});
test("只认唯一 engineerEyes，名字后备不会越过明确配置",async()=>{
  const M=await import("../scripts/cc-auto-memory-context.mjs");
  assert.equal(M.resolveYanqiu([{id:"a",name:"言秋"},{id:"b",name:"B"}],{b:{engineerEyes:true}}).id,"b");
});
