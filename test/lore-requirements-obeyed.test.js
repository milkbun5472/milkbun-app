const test=require("node:test");const assert=require("node:assert");const fs=require("fs");
test("世界书里写成对他的要求的，不管哪一类都照着来",()=>{
  const e=fs.readFileSync(__dirname+"/../js/engine.js","utf8");
  const i=e.indexOf("const WORLDBOOK_RULE = `");const blk=e.slice(i,e.indexOf("`;",i));
  assert.ok(blk.includes("不管分在哪一类，条目里写成【对你的要求】的"));
});
