// 裁判每轮不再只有一句（她 2026-09-23：「裁判还是有点单薄他说的话」）。
const assert = require("assert");
const src = require("fs").readFileSync(__dirname + "/../js/debate.js", "utf8");
assert(!/说一句（call）/.test(src), "不再只要一句");
assert(/这一轮的判语（call），2~4 句/.test(src));
assert(/凭的是台上【哪一句】/.test(src), "得落在台上真说过的话上");
assert(/直接冲TA说/.test(src));
assert(/跟不跟台下/.test(src), "台下的票要有回应");
console.log("debate-judge-call ok");
// 她 2026-10-08：「裁判还是人机」——那几条是可挑的，不是挨个交的清单
assert(/每轮只交给TA一个角度/.test(src) && /function judgeAngle\(/.test(src) && !/别顺手再补上/.test(src));
assert(!/逼TA下一轮把那处答上/.test(src));
