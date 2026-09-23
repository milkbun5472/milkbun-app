// 裁判每轮不再只有一句（她 2026-09-23：「裁判还是有点单薄他说的话」）。
const assert = require("assert");
const src = require("fs").readFileSync(__dirname + "/../js/debate.js", "utf8");
assert(!/说一句（call）/.test(src), "不再只要一句");
assert(/这一轮的判语（call），2~4 句/.test(src));
assert(/凭的是台上【哪一句】/.test(src), "得落在台上真说过的话上");
assert(/可以直接冲台上某人说话/.test(src));
assert(/跟不跟台下/.test(src), "台下的票要有回应");
console.log("debate-judge-call ok");
