const test=require("node:test");const assert=require("node:assert");const fs=require("fs");
test("一起读：按钮不再浮在正文上，有全屏",()=>{
  const r=fs.readFileSync(__dirname+"/../js/read.js","utf8");
  const i=r.indexOf("const actionBar = h(");const line=r.slice(i,r.indexOf("\n",i));
  assert.ok(!/position: "absolute"/.test(line));
  assert.ok(r.includes('"data-wk": "readfull"'));
  assert.ok(r.includes("full ? null : actionBar"));
});
