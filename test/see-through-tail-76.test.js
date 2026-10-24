// 她 2026-10-23：翻旧账、看穿她那一族，上一轮这么说了这一轮提一句（不引原句、不删他的话）
const assert = require("node:assert/strict");
const rd = f => require("node:fs").readFileSync(require("node:path").join(__dirname, "..", "js", f), "utf8");
const eng = rd("engine.js"), app = rd("app.js");
const re = new Function(eng.match(/const SEE_THROUGH_TAIL_RE = (\/.*\/);/)[0] + " return SEE_THROUGH_TAIL_RE;")();
["某些人前几天赖在床上哼哼唧唧说动不了的时候怎么不提这茬", "嘴上厉害得要死 真到跟前不知道谁先喊累", "某人刚才还说不困", "上次喝醉的时候怎么没见你这么硬气"]
  .forEach(t => assert.ok(re.test(t), "该认出：" + t));
["前几天你说胃疼，现在好点没", "上次那家店还挺好吃的", "某某同学借了我笔记", "人家某人家里的猫丢了", "榨干个屁啊！"]
  .forEach(t => assert.ok(!re.test(t), "不该认：" + t));
const hint = eng.match(/const SEE_THROUGH_TAIL_HINT = "(.*)";/)[1];
assert.ok(!re.test(hint), "提醒里别念原句");
// 中间还会插别的收尾提示（v76.476 叮嘱收尾 _bossTailHint），钉的是看穿那一句接进了收尾串
assert.match(app, /\+ _threatTailHint( \+ \w+)* \+ _seeThroughHint \+ _turnClosing/);
assert.match(app, /const _seeThroughHint = !_body && /);
console.log("ok");
