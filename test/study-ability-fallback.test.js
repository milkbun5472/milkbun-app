const test=require("node:test");const assert=require("node:assert");const fs=require("fs");
test("能不能教判不出来时放行，不当教不了",()=>{
  const s=fs.readFileSync(__dirname+"/../js/study.js","utf8");
  const i=s.indexOf("async function inferAbility");const seg=s.slice(i,s.indexOf("\n  }\n",i));
  assert.ok(seg.includes('if (!d || d.canTeach == null) return { canTeach: true'));
  assert.ok(seg.includes('catch (e) { return { canTeach: true'));
  assert.ok(!seg.includes("canTeach: false, level"));
});
