// 「写到需要她才停」之后开始拿背景交代凑篇幅（她 2026-09-23：「现在模型写线下会带人物背景交代了」）。
const assert = require("assert");
const eng = require("fs").readFileSync(__dirname + "/../js/engine.js", "utf8");
const r0 = eng.indexOf("const OFFLINE_AGENCY_RULE = `");
const rule = eng.slice(r0, eng.indexOf("`;", r0));
assert(/接着写的只能是【此刻正在发生的事】/.test(rule));
assert(/【别拿身世当填充】/.test(rule), "要指回那一条，不另起一条");
assert(/眼前没有新的事可写，就说明已经到了该停的地方/.test(rule));
const line = eng.split("\n").find(l => l.startsWith("const FLASHBACK_CUE = "));
const re = eval(line.replace(/^const FLASHBACK_CUE = /, "").replace(/;\s*$/, ""));
assert(re.test("在京城这十二年，我身边永远围着一堆算盘珠子"), "这十二年那种也要摆回去");
assert(re.test("这些年我一直留着半个心眼"));
assert(!re.test("这一年过得挺快"), "当下的「这一年」别当回忆");
console.log("offline-no-backstory-fill-73-19 ok");
