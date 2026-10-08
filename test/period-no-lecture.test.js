const test=require("node:test");const assert=require("node:assert");const fs=require("fs");
const a=fs.readFileSync(__dirname+"/../js/app.js","utf8");
test("生理期那一行不再请他「提醒注意事项」，分享吃的不借机训话",()=>{
  const i=a.indexOf('return "用户此刻的生理期状态：');const line=a.slice(i,a.indexOf("\n",i));
  assert.ok(!line.includes("提醒注意事项"));
  assert.ok(line.includes("别借生理期去挑她吃得对不对"));
});
