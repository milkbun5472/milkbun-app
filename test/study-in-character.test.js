const test=require("node:test");const assert=require("node:assert");const fs=require("fs");
const s=fs.readFileSync(__dirname+"/../js/study.js","utf8");
test("一起学收尾把人摆回面前，一起研究不再把本行角色按成外行",()=>{
  assert.ok(s.includes("【开口的是谁】"));
  assert.ok(s.indexOf('parts.push("【开口的是谁】')<s.indexOf("parts.push(OUT_FMT + voiceHint(char));"));
  assert.ok(!s.includes('"你并不比TA更懂'));
  assert.ok(s.includes("别装外行"));
});
