const test=require("node:test");const assert=require("node:assert");const fs=require("fs");
test("一起读：点他的批注就能回那一句",()=>{
  const r=fs.readFileSync(__dirname+"/../js/read.js","utf8");
  assert.ok(r.includes('const tapReply = a.who === "user" ? null'));
  assert.ok(r.includes('"〔回你批的那句「"'));
  assert.ok(r.includes('"data-wk": "readreplyquote"'));
  assert.ok(r.includes("next, mine.content, props.ctxFor"));
});
