const fs = require("fs"), assert = require("assert");
const s = fs.readFileSync(__dirname + "/../js/theater.js", "utf8");
// 群友 2026-11-28 许愿：小剧场可以不设目标，自由发挥
assert(/goal: freeGoal \? "" : draft\.goal/.test(s), "开局选了不设目标，第一轮目标留空");
assert((s.match(/!String\(round\.goal \|\| ""\)\.trim\(\) \? FREE_LINE :/g) || []).length === 2, "两处演出提示都认空目标");
assert(/const open = r => !!String\(r\.goal \|\| ""\)\.trim\(\) && !r\.goalDone && !r\.failed;/.test(s), "没目标就不弹达成");
assert(/pendingFail: open\(r\) && !p\.goalReached && !!p\.goalFailed/.test(s), "没目标就不弹走不通");
assert(/"data-wk": "thrfreegoal"/.test(s));
console.log("ok theater-free-goal");
