const test=require("node:test");const assert=require("node:assert");const fs=require("fs");
test("补时间戳的那条把发出时刻告诉TA，话里报钟点照那会儿说",()=>{
  const a=fs.readFileSync(__dirname+"/../js/app.js","utf8");
  assert.ok(a.includes("const dongnianHint = backdateHint + peekHint"));
  assert.ok(a.includes("【这条消息的发出时间】"));
});
