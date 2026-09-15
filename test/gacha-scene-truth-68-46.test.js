// 她 2026-09-15：「他拍出来的照片场景也要符合人设，不能拍出他原本不会做的事情，
// 比如怕水的人就不会有海滩合照之类的」。
//
// ⚠️我上一轮答的是另一层：出图那头的脸和画风不走样。她问的是**这个人会不会出现在
//   这个画面里**——那在【文字那一枪挑场景】的时候就定了，跟出图没关系。
// ⚠️原有那句「换个角色照样成立就是写坏了」管的是【像不像他】，不是【他会不会真的去】。
//   怕水的人站在海边，那一条是过得去的——所以要单立一条。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..");
const K = require(path.join(root, "js/gacha.js"));
const gac = fs.readFileSync(path.join(root, "js/gacha.js"), "utf8");

const SCENE_CARDS = ["x_duo", "x_date", "x_offline", "s_date", "x_plan"];

test("凡是模型自己挑场景的那几张，都带上了这一条", () => {
  SCENE_CARDS.forEach(id => {
    assert.equal(K.byId[id].scene, true, id + " 没登记成挑场景的卡");
    const phases = typeof K.byId[id].ask === "string" ? [null] : Object.keys(K.byId[id].ask);
    phases.forEach(p => assert.match(K.askOf(id, p), /我为什么会在这儿/, id + (p ? "/" + p : "")));
  });
});

test("不挑场景的那些一个字都不加——别白占额度", () => {
  ["s_word", "s_note", "s_praise", "s_joke", "s_truth", "s_title", "x_box", "x_flow", "x_past"]
    .forEach(id => assert.doesNotMatch(K.askOf(id, "his") + K.askOf(id), /我为什么会在这儿/, id));
});

test("挂在卡上，不是在调用点一条条 push", () => {
  // 一条条 push 的东西，加新卡时换个入口就一条都没有，而且不留能 grep 的痕迹
  assert.match(gac, /return card\.scene \? base \+ SCENE_TRUTH : base;/);
  const app = fs.readFileSync(path.join(root, "js/app.js"), "utf8");
  assert.doesNotMatch(app, /SCENE_TRUTH/, "app.js 那头又抄了一份");
});

test("给判据，不给禁令清单（bans-make-it-dumber）", () => {
  const t = K.SCENE_TRUTH;
  assert.match(t, /「我为什么会在这儿」——你答得上来吗？/);
  assert.match(t, /答不上来就换一个/);
  // ⚠️不许列「不许海边/不许游乐园」：既挡不住下一种，还会让所有角色都不去海边
  assert.doesNotMatch(t, /不许去|禁止出现|不得出现在/);
});

test("不举例子（prompt-no-content-samples）——写一句「怕水的人不会在海边」就会被抄", () => {
  const t = K.SCENE_TRUTH;
  assert.doesNotMatch(t, /如「|例如|比如/);
  assert.doesNotMatch(t, /海滩|海边|游乐园/, "举了例子，从此谁都不去那儿");
});

test("说清它跟「像不像他」是两件事", () => {
  assert.match(K.SCENE_TRUTH, /不像你的那一个是写坏了，\*\*你根本不会去的那一个是假的\*\*/);
  // 原来那句还在，两条并存
  assert.match(K.askOf("x_duo"), /换个角色照样成立的画面就是想坏了/);
});
