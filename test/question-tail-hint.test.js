// 她 2026-11-27「模型怎么这么爱反问，不挂世界书最后一句就是问问题」：上一轮拿问句收尾，这一轮点一句；「停在她能接的地方」不等于问她一句
const assert = require("node:assert/strict"), fs = require("fs");
const eng = fs.readFileSync("js/engine.js", "utf8");
const a = eng.indexOf("const BOSSING_CHECK_RE"), b = eng.indexOf("const QUESTION_TAIL_HINT", a);
const f = new Function(eng.slice(a, b).replace(/^const BOSSING_CHECK_RE/, "const BOSSING_CHECK_RE") + ";return endsOnQuestion;")();
for (const t of ["那你呢？", "今天吃的什么?", "想我没有？~"]) assert.ok(f(t), t);
for (const t of ["我先去忙了", "别熬夜了，听到没有？", "你知道吗我今天", "嗯"]) assert.ok(!f(t), t);
assert.match(eng, /const ask = !threat && !boss && endsOnQuestion\(tail\) \? QUESTION_TAIL_HINT : "";/);
assert.match(eng, /return threat \+ boss \+ ask \+ see;/);
assert.ok(!/QUESTION_TAIL_HINT = [^\n]*「/.test(eng), "提醒里不引原句、不举例");
assert.match(eng, /她能接的地方不是非得一个问句/);
console.log("ok");
