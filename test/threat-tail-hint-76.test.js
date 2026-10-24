// 她 2026-10-22：「就是爱撂狠话啊喂」——上一轮拿狠话收尾，这一轮末尾提一句（只说事实、不引原句）
const assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path");
const eng = fs.readFileSync(path.join(__dirname, "..", "js", "engine.js"), "utf8");
const app = fs.readFileSync(path.join(__dirname, "..", "js", "app.js"), "utf8");
const re = new Function(eng.match(/const THREAT_TAIL_RE = (\/.*\/);/)[0] + " return THREAT_TAIL_RE;")();
["有本事等下真别开", "我看你是皮痒得不行了今晚等着！", "你今晚给我老实待着看我怎么收拾你！", "不然我直接把你嘴缝上！"]
  .forEach(t => assert.ok(re.test(t), "该认出：" + t));
["收工了！", "我手指现在全是松香和机油味", "语文老师听到当场能气厥过去"]
  .forEach(t => assert.ok(!re.test(t), "不该认：" + t));
const hint = eng.match(/const THREAT_TAIL_HINT = "(.*)";/)[1];
assert.ok(!re.test(hint), "提醒里别念原句");
assert.match(app, /\+ _rerollHint \+ _threatTailHint \+ (_bossTailHint \+ )?(_seeThroughHint \+ )?_turnClosing/);
assert.match(app, /const _threatTailHint = !_body && /);   // 言秋／本体模式不加
console.log("ok");
// 她 2026-10-23 截图：「别逼我顺着网线爬过去把你的嘴捂住」
assert.ok(re.test("别逼我顺着网线爬过去把你的嘴捂住"));
assert.ok(re.test("信不信我现在就过去"));
assert.ok(!re.test("别逼自己太紧"));
console.log("ok 2");
