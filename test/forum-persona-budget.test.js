const test=require("node:test");const assert=require("node:assert");const fs=require("fs");
test("论坛里角色的人设按人数分额度，不再只给几十个字",()=>{
  const a=fs.readFileSync(__dirname+"/../js/app.js","utf8");
  assert.ok(a.includes("const _fpBudget = Math.max(400, Math.min(2000, Math.floor(8000 / Math.max(1, poolChars.length))));"));
  assert.ok(!/String\(c\.persona \|\| ""\)\.slice\(0, 36\)/.test(a));
  assert.ok(!/replace\(\/\\s\+\/g, " "\)\.slice\(0, 80\) \+ \(moods/.test(a));
});
