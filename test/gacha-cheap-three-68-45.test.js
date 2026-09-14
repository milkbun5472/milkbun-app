// v68.45：言秋给公版列的那几张便宜好使的（在我们家进 SR）+ 合照券。
//
// 她问的两件事：「生图券能不能只有兑换了才生图」「怎么保证 prompt 不 OOC」。
// 答案都是【别另起一套】：抽本来就 0 调用；真画那一下走照相馆那条现成的链，
// 它已经把身份锁、画风锁、穿着优先级和「两张参考照缺一张就拦」全办完了。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..");
const K = require(path.join(root, "js/gacha.js"));
const app = fs.readFileSync(path.join(root, "js/app.js"), "utf8");
const eng = fs.readFileSync(path.join(root, "js/engine.js"), "utf8");
const scr = fs.readFileSync(path.join(root, "js/screens.js"), "utf8");
const branch = act => {
  const i = app.indexOf('if (card.act === "' + act + '"');
  assert.ok(i > 0, act);
  return app.slice(i, app.indexOf("\n      }\n", i));
};

test("彩虹屁：不许夸「一个女朋友」，只准夸真发生过的事", () => {
  const a = K.askOf("s_praise");
  assert.match(a, /只准夸上面那些真发生过的事/);
  assert.match(a, /换谁都成立的句子，一句都不许有/);
  // 腔调也归人设，不是统一的甜
  assert.match(a, /嘴硬的人夸起来是别扭的/);
});

test("冷笑话：笑话本身不重要，讲笑话的样子才重要", () => {
  const a = K.askOf("s_joke");
  assert.match(a, /你讲笑话的样子才重要/);
  assert.match(a, /换个角色讲出来一模一样的那个笑话，就是挑坏了/);
  assert.equal(K.toneOf(K.byId.s_joke), "tease");
});

test("真心话：题目是她出的，没题就不花那一枪", () => {
  assert.match(K.askOf("s_truth"), /\{Q\}/);
  assert.match(branch("truth"), /\.replace\("\{Q\}", q\)/);
  assert.match(branch("truth"), /if \(!q\) \{ toast\("先写你要问的那个问题"\); return; \}/);
  assert.match(scr, /requestAppPrompt\("你想问他什么？"/);
  assert.match(scr, /onRedeem\(\{ \.\.\.card, q: q \}\)/);
  // 「正面答」给了出口，不是逼他交代（bans-make-it-dumber）
  const a = K.askOf("s_truth");
  assert.match(a, /答得吞吞吐吐、答一半、答完又后悔[\s\S]{0,40}都算正面答/);
  assert.match(a, /不算的只有一种/);
});

test("合照券：兑出来先是文字，真画要她再按一下", () => {
  const fn = branch("duo");
  assert.match(fn, /scene: scene, where: "duo"/);
  assert.doesNotMatch(fn, /studioShoot|imgApiReady/, "兑换那一下就去生图了——没配图像 key 的人这张券就废了");
  assert.match(scr, /onShoot\(card\)/);
  assert.match(scr, /真拍出来/);
  // 没配 key / 少参考照也照样看得到文字那半
  assert.match(scr, /res\.where === "duo" && res\.scene \? h\("div"/);
});

test("⚠️不另起一套出图：真画那一下走照相馆那条现成的链", () => {
  const i = app.indexOf("    onGachaShoot: async card => {");
  assert.ok(i > 0);
  const fn = app.slice(i, app.indexOf("\n    },", i));
  assert.match(fn, /await studioShoot\(c, \{ scene: scene \}\)/);
  // 不在这儿重复判一遍——那条链自己会说人话
  assert.doesNotMatch(fn, /buildPhotoPrompt|imgApiReady|refPhoto/, "又在抽卡这头抄了一份把关");
});

test("那条链里「怎么保证不 OOC」的几道锁都还在", () => {
  // 身份锁：参考图是硬性来源，保不住身份宁可失败
  assert.match(eng, /所有人物参考图都是硬性身份来源[\s\S]{0,200}无法保留全部身份时应失败，而不是生成陌生人/);
  // 画风锁：跟角色自己的 photoStyle 走，不许擅自 2D 转真人
  assert.match(eng, /不要擅自把 2D 改成 3D 或真人，也不要把真人改成动漫/);
  // 穿什么的优先级
  assert.match(eng, /photoOutfit（手动锁死）＞ 此刻真穿着 ＞ 衣柜里真有的 ＞ 人设/);
  // 合照缺一张参考照就降级——杜绝一张真一张编
  assert.match(app, /合照必须两张参考照都在，否则降级为「别人拍的单人照」——杜绝一张真一张编/);
  assert.match(app, /if \(photoKind === "duo" && !\(char\.refPhoto && profile && profile\.refPhoto\)\) photoKind = "other";/);
});

test("四张都接进了记忆库那一层（v68.40）", () => {
  const i = app.indexOf("  const GACHA_KEEP = {");
  const tbl = app.slice(i, app.indexOf("\n  };", i));
  ["praise", "joke", "truth", "duo"].forEach(k => assert.match(tbl, new RegExp("\\n    " + k + ":"), k));
  assert.match(branch("truth"), /gachaKeep\(char, "truth", q, body\)/);
  assert.match(branch("duo"), /gachaKeep\(char, "duo", title/);
  // 彩虹屁和冷笑话共用一条兑换路，记的时候要分得开
  assert.match(branch("make1"), /card\.poolId === "s_joke" \? "joke" : "praise"/);
});
