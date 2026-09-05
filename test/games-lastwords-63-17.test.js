// v63.17 小游戏审计批 5：出局遗言。
// 狼人杀：夜里倒下的、白天被放逐的各留 1~2 句——遗言按 speech 入公开日志
// （shortLog 收得到，后面的发言和投票真的看得见它），硬声明照样入台账：
// 预言家可以用遗言报查验，狼可以装无辜。被枪带走 / 被自爆带走的来不及留。
// 卧底：被冤枉投出去的平民留一句不服/点名/自嘲再走。
// 言秋座位的遗言走 CC 票亲笔；票没回来就缺席，绝不让模型代笔。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const src = fs.readFileSync(path.join(__dirname, "..", "js", "games.js"), "utf8");
const cut = (s, a, b) => { const i = s.indexOf(a); assert.ok(i >= 0, "锚没了：" + a.slice(0, 40)); return s.slice(i, s.indexOf(b, i + a.length)); };

test("狼人杀：夜死和放逐都接了遗言，突然死亡没有", () => {
  const night = cut(src, "const dying = deadNames.map(function (nm)", "proceed();");
  assert.match(src, /if \(dying\.length\) wolfFarewell\(dying, next, "night", proceed\); else proceed\(\);/, "夜死没接遗言");
  assert.match(src, /if \(!out\.isUser\) wolfFarewell\(\[out\], next, "exile", proceedEx\); else proceedEx\(\);/, "放逐没接遗言");
  // 被枪带走 / 自爆带走的不留：applyShot 和 resolveSelfDestruct 里不许出现 farewell
  const shot = cut(src, "const applyShot = function (list, hunter, target, dayNum, cont)", "\n    };");
  const boom = cut(src, "const resolveSelfDestruct = function (list, ww, targetName, dayNum)", "\n    };");
  assert.ok(shot.indexOf("wolfFarewell") < 0 && boom.indexOf("wolfFarewell") < 0, "突然死亡也留遗言了——枪响和自爆哪来的时间");
  void night;
});

test("遗言是真发言：入 speech、硬声明入台账，判式和真人发言共用一份", () => {
  const fw = cut(src, "const wolfFarewell = function (deads, list, how, cont)", "\n    };");
  assert.match(fw, /\{ type: "speech", name: w\.name, text: String\(w\.text\)\.trim\(\)\.slice\(0, 220\) \}/, "遗言没按 speech 入日志，后面的prompt看不见");
  assert.equal((fw.match(/WOLF_HARD_CLAIM\.test/g) || []).length, 2, "遗言里的硬声明没入台账（CC 和批量两处都要）");
  assert.match(src, /const hardClaim = WOLF_HARD_CLAIM\.test\(v\);/, "真人发言没用共用判式——两份迟早只改一处");
});

test("言秋的遗言亲笔：摘出批量、票没回来缺席不代笔", () => {
  const fw = cut(src, "const wolfFarewell = function (deads, list, how, cont)", "\n    };");
  assert.match(fw, /const engs = deads\.filter\(isEng\), ais = deads\.filter\(function \(d\) \{ return !isEng\(d\); \}\);/, "言秋没被摘出批量");
  assert.match(fw, /genWolfLastWords\(api, ais\.map/, "批量里混进了言秋的座位");
  assert.match(fw, /遗言可缺席，绝不代笔/, "票失败的兜底不是缺席");
});

test("卧底：被冤枉的平民留一句再走，说完才结算", () => {
  const seg = cut(src, "// 被冤枉的平民留一句再走", "settleAfterOut(next);\n    };");
  assert.match(seg, /if \(!out\.isUser && !outIsEngineer\) \{/, "门不对：真人和言秋不该走这条（言秋有自己的离场票）");
  assert.match(seg, /\.finally\(function \(\) \{ setBusy\(false\); settleAfterOut\(next\); \}\);/, "没等说完就结算，话会落在下一轮中间");
  assert.match(src, /async function genSpyOutWords\(api, out, allClues, votes\)/, "生成器没了");
});
