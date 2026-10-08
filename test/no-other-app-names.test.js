const test=require("node:test");const assert=require("node:assert");const fs=require("fs");
// 她 2026-10-08：「攻略和也不准提到酒馆」——攻略和界面上给人看的字都不提别家
test("攻略和界面文字里不出现「酒馆」",()=>{
  for (const f of ["assistant-manual.js","screens.js","style-lab.js","components.js","app.js"]) {
    const bad=fs.readFileSync(__dirname+"/../js/"+f,"utf8").split("\n").filter(l=>l.includes("酒馆")&&!/^\s*\/\//.test(l));
    assert.deepEqual(bad,[],f+" 里还有给人看的「酒馆」");
  }
});
