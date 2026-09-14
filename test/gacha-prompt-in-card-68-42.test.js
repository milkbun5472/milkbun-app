// 她 2026-09-14 转来言秋给公版写的那份，里头有条私货：
// 「奖品本质＝带参数的 prompt 模板，池子就是一张 JSON 表，加奖品＝加行，别做成硬编码」。
//
// 我们这边 POOLS 本来就是那张表，但**提示词住在 js/app.js**：加一张卡要动两个文件，
// 而且永远可能只改一处——正是这个仓库犯过太多次的那个形状。搬过来之后一行就是一张完整的卡。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..");
const K = require(path.join(root, "js/gacha.js"));
const app = fs.readFileSync(path.join(root, "js/app.js"), "utf8");
const scr = fs.readFileSync(path.join(root, "js/screens.js"), "utf8");

test("提示词搬进卡表了，app.js 里不许再留第二份", () => {
  assert.doesNotMatch(app, /GACHA_SR_ASK|GACHA_SSR_ASK/, "旧那两张表还在，就是又多了一处要同步的地方");
  assert.match(app, /const gAsk = \(poolId, phase\) => \(window\.GachaKit\.askOf\(poolId, phase\) \|\| ""\)/);
});

test("每一张要花调用的卡都带着自己的提示词", () => {
  // R 是 0 调用（从她已有的东西里翻），本来就不该有 ask
  K.POOLS.forEach(p => {
    if (p.r === "R") return assert.ok(!p.ask, p.id + " 是 R，不该有提示词");
    if (p.act === "letter") return;          // 情书走 genCoupleLetter，那边自己有
    assert.ok(p.ask, p.id + " 没带提示词");
  });
});

test("一张卡好几段的，按阶段取", () => {
  ["sweet", "tease"].forEach(k => assert.ok(K.askOf("s_dual", k).length > 40, k));
  ["out", "home", "open"].forEach(k => assert.ok(K.askOf("x_plan", k).length > 40, k));
  ["his", "open"].forEach(k => assert.ok(K.askOf("x_box", k).length > 40, k));
  // 取不到的给空串，不给 undefined（拼进 prompt 会变成字面量 "undefined"）
  assert.equal(K.askOf("x_plan", "没这一段"), "");
  assert.equal(K.askOf("压根没这张卡"), "");
  assert.equal(K.askOf("r_photo"), "");
});

test("兑换那一头一处都没落下", () => {
  ["s_drop", "s_pocket", "x_seed", "x_flow", "x_forme"].forEach(k =>
    assert.match(app, new RegExp('gAsk\\("' + k + '"'), k + " 没接上"));
  assert.match(app, /gAsk\("s_dual", side\)/);
  assert.match(app, /gAsk\("x_plan", side\)/);
  assert.match(app, /gAsk\("x_box", "his"\)/);
  // make 那六张和 past/pact/offline/date/gaze 都按 poolId 取，不再按 kind/act 分两路
  assert.equal((app.match(/gAsk\(card\.poolId\)/g) || []).length, 3, "按卡取那几处数不对");
});

// ── 反向扭蛋券：整份里最好的一张 ──
test("他挑的那张是【真的一张券】，会落进券夹", () => {
  const i = app.indexOf('if (card.act === "forme") {');
  assert.ok(i > 0);
  const fn = app.slice(i, app.indexOf("\n      }\n", i));
  assert.match(fn, /window\.GachaKit\.pickForMe/);
  assert.match(fn, /fromHim: true, fromWhy: why/);
  assert.match(fn, /saveJSON\("x_gachaCards", nl\)/, "他挑的那张没真发出来——那就只是一段好听的话");
  // 券夹上看得出这一张是他挑的
  assert.match(scr, /g\.first && g\.first\.fromHim \?/);
});

test("他挑的时候不挑 R，也不挑到自己", () => {
  const have = {}; ["album", "notes", "memlib"].forEach(k => { have[k] = 1; });
  for (let i = 0; i < 60; i++) {
    const c = K.pickForMe({ have: have });
    assert.notEqual(c.r, "R", "挑到 R 了——那是翻她已经有的东西，不像特意挑给谁");
    assert.notEqual(c.poolId, "x_forme", "挑到自己了，套娃");
  }
});

test("提示词里那两个占位真的被换掉了", () => {
  const a = K.askOf("x_forme");
  assert.match(a, /\{PICK\}/);
  assert.match(a, /\{HINT\}/);
  assert.match(app, /\.replace\("\{PICK\}", pick\.name\)\.replace\("\{HINT\}", pick\.hint\)/);
  // 说的是「为什么想让她拿到这个」，不是夸这张券
  assert.match(a, /别夸这张券好/);
  assert.match(a, /换个角色照样成立的那几句，就是挑坏了/);
});
