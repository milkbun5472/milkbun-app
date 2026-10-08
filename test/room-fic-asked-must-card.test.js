const test=require("node:test");const assert=require("node:assert");const fs=require("fs");
test("她叫他写下一章，ficNext 一定要填",()=>{
  const a=fs.readFileSync(__dirname+"/../js/app.js","utf8");
  assert.ok(a.includes("她这一轮开口叫你写、续写、接下一章，就一定要填"));
});
