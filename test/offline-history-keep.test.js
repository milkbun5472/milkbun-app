const test=require("node:test");const assert=require("node:assert");const fs=require("fs");
test("pOffline 内存没这人时从存储读，不拿 [] 当底",()=>{
  const s=fs.readFileSync(__dirname+"/../js/app.js","utf8");
  assert.ok(s.includes('const before = prev[scopeKey] || offlinesRef.current[scopeKey] || loadJSON("x_offline:" + scopeKey, []) || [];'));
});
