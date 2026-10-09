const test=require("node:test");const assert=require("node:assert");const fs=require("fs");
test("论坛和朋友圈：不同意要有来由，抬杠不再是配料",()=>{
  const a=fs.readFileSync(__dirname+"/../js/app.js","utf8");
  assert.ok(a.includes("const REAL_DISAGREE = "));
  assert.ok((a.match(/\+ REAL_DISAGREE/g)||[]).length>=3);
  assert.ok(!a.includes("有人附和、有人抬杠、有人接梗歪楼"));

});
