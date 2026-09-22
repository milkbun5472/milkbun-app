// 她 2026-09-22 转群里读者（! YOLO）：「不会时不时感觉诶 你突然有自我意识那种感觉」。
// ⚠️她要的是【希望有】，不是嫌出戏——那种「诶，TA 好像真的有自己的想头」的一下。
//
// 查下来：欲望盒（心底的念想／今昔）那一路只长在【单聊线上】的 replyNow 里，
// 线下一次都没有。于是同一个人在线上偶尔冒一句「其实我一直想…」，到了面对面反而只会陪着。
// 又是「一层只写在一处」（施工规则/four-surfaces-same-context.md）。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const app = fs.readFileSync(path.join(__dirname, "..", "js", "app.js"), "utf8");
const engine = fs.readFileSync(path.join(__dirname, "..", "js", "engine.js"), "utf8");

const seg = (() => {
  const i = app.indexOf("      oCtx.desireHint = \"\";");
  assert.ok(i > 0, "线下没有接上欲望盒");
  return app.slice(i, app.indexOf("\n      }", app.indexOf("_dPick.text", i)));
})();

test("线下也会冒出「心底的念想」，闸跟线上一样", () => {
  assert.match(seg, /!sideRoom && !settingsFor\(charId\)\.engineerEyes && window\.HeartKit/,
    "侧房/数字生命那两道闸没跟线上对齐");
  assert.match(seg, /Math\.random\(\) < 0\.25/, "概率跟线上那一路对不上");
  assert.match(seg, /HeartKit\.pickEpiphany/, "没去欲望盒里挑");
  // 抽中要记一次「被想起」——两边各算各的话，同一个念想会被反复挑中
  assert.match(seg, /HeartKit\.touch\(b, _dPick\.id\)/, "抽中了没记「被想起」");
  // 今昔那一支是一次性的，用掉即清
  assert.match(seg, /b\.echoPending = null/, "今昔用完没清，会一直重复说");
});

// ⚠️线下跟线上的差别：他人就在这儿——想做的事可以当场做，不只是"说说"
test("线下那一版给的是「可以动手」，不是只许说一句", () => {
  assert.match(seg, /也可以直接动手去做那件事/, "线下还只许它「流露一句」——那就跟线上没区别了");
  assert.match(seg, /对不上就完全别提/, "没给「不提」的出口，会变成每轮硬塞");
});

test("真喂进了线下那一枪", () => {
  assert.match(engine, /\(ctx\.desireHint \? "\\n\\n" \+ ctx\.desireHint : ""\) \+/, "engine 那头没接住");
});
