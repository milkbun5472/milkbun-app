const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

global.window = {};
require("../js/heart.js");
const app = fs.readFileSync(path.join(__dirname, "../js/app.js"), "utf8");

const cand = extra => Object.assign({
  text: "我想和她一起养一盆薄荷", quote: "我想以后和你一起养一盆薄荷。",
  type: "CC欲望候选", note: "言秋在 CC 亲口说：“我想以后和你一起养一盆薄荷。”"
}, extra || {});

test("候选只进纸条、不直写正式念想，并按来源键幂等", () => {
  const box = window.HeartKit.boxOf({}, "yanqiu");
  assert.equal(window.HeartKit.ingestCandidate(box, cand(), "cc:k:1", 123), true);
  assert.equal(box.list.length, 0);
  assert.equal(box.briefs.length, 1);
  assert.equal(box.briefs[0].candidateText, cand().text);
  assert.equal(window.HeartKit.ingestCandidate(box, cand(), "cc:k:1", 456), false);
  assert.equal(box.briefs.length, 1);
});

test("坏候选安静拒绝，不污染盒子", () => {
  const box = window.HeartKit.boxOf({}, "yanqiu");
  assert.equal(window.HeartKit.ingestCandidate(box, cand({ text: "" }), "cc:k:2", 123), false);
  assert.equal(window.HeartKit.ingestCandidate(box, cand({ note: "" }), "cc:k:3", 123), false);
  assert.equal(box.briefs.length, 0);
});

// 她 2026-09-16 指着如果馆那张纸条：「这个跟 cc 和言秋没关系啊，这是别人的」
// 原来措辞写死在函数里，可走这条路的不止 CC 那一处——如果馆的「留成一个念头」
// 是所有人都有的功能，别人收一条线，纸条上就冒出我俩那套私称呼。
test("纸条上的措辞由调用方给，函数自己不认得任何一个调用方", () => {
  const heart = fs.readFileSync(path.join(__dirname, "../js/heart.js"), "utf8");
  const fn = heart.slice(heart.indexOf("function ingestCandidate("), heart.indexOf("// ---- 每日发呆的 probe 规格"));
  assert.doesNotMatch(fn, /言秋|CC欲望候选/, "通道里不许再写死某一个调用方的称呼");
  assert.doesNotMatch(heart, /ingestCcCandidate/, "旧名字要一并搬走，不许留两个入口");
  const box = window.HeartKit.boxOf({}, "c1");
  window.HeartKit.ingestCandidate(box, cand({ type: "如果馆", note: "你俩在「如果馆」一起想过这条线，TA 当时说：“回来就好”" }), "ifline:1", 1);
  assert.equal(box.briefs[0].type, "如果馆");
  assert.doesNotMatch(box.briefs[0].note, /言秋|CC/);
});

test("两个调用方各给各的措辞，如果馆那条不带私称呼", () => {
  const ifEnd = app.slice(app.indexOf("    } else if (how === \"seed\") {"), app.indexOf("\"ifline:\" + line.id"));
  assert.match(ifEnd, /type: "如果馆"/);
  assert.doesNotMatch(ifEnd, /言秋|CC/);
  const ccPath = app.slice(app.indexOf("const ccDesires = freshEvents"), app.indexOf("const ccDesires = freshEvents") + 900);
  assert.match(ccPath, /type: "CC欲望候选"/, "CC 那一处的措辞仍是它自己的");
});
