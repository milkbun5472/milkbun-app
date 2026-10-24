// 她 2026-10-24 截图：「你在家要是饿了先找点零嘴垫垫，别又忍着等晚饭」——拿一句叮嘱收尾；静态那段写着照样出，按轮提一句
const assert = require("node:assert/strict"), fs = require("fs");
const eng = fs.readFileSync("js/engine.js", "utf8"), app = fs.readFileSync("js/app.js", "utf8");
const a = eng.indexOf("const BOSSING_TAIL_RE"), b = eng.indexOf("const BOSSING_TAIL_HINT", a);
const f = new Function(eng.slice(a, b) + ";return endsOnBossing;")();
for (const t of ["你在家要是饿了先找点零嘴垫垫，别又忍着等晚饭", "记得吃饭", "早点睡", "别熬太晚了", "外面冷，多穿点，别再感冒了", "乖乖等我回来"]) assert.ok(f(t), t);
for (const t of ["差不多五点左右收工回来给你烤黑椒肋排", "你吃饭了吗", "我记得你说过不吃香菜", "别的事回头再说吧？", "我先去忙了", "今天别的都还好", "别的先不管了", "别人家的猫"]) assert.ok(!f(t), t);
assert.match(app, /const _bossTailHint = !_body && !_threatTailHint && typeof endsOnBossing === "function" && endsOnBossing\(_prevTail\) \? BOSSING_TAIL_HINT : "";/);
assert.match(app, /_threatTailHint \+ _bossTailHint \+ _seeThroughHint/);
assert.ok(!/BOSSING_TAIL_HINT = [^\n]*「/.test(eng), "提醒里不引原句、不举例");
assert.match(eng, /最常见的一种是拿一句替她安排她自己的事/);
console.log("ok");
assert.match(eng, /· 她平时过日子的习惯和毛病/); assert.match(eng, /最容易被顺手编出来的是这四类/);
