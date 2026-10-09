const test=require("node:test");const assert=require("node:assert");const fs=require("fs");
test("一起读：讲解、批注、讨论不再按死句数／条数，讨论看得到整页",()=>{
  const r=fs.readFileSync(__dirname+"/../js/read.js","utf8");
  assert.ok(!r.includes("每段 1~3 句"));assert.ok(r.includes("讲到她看懂为止"));
  assert.ok(!r.includes("拆成 1~3 条短气泡"));assert.ok(r.includes("几条、每条多长照你平时跟她聊天的习惯来"));
  assert.ok(r.includes('paras.join("\\n").slice(0, 8000)'));
  assert.ok(!r.includes("短、有你这个人的味道"));
});
