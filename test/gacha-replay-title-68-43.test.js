// 第五刀（她 2026-09-14「两个都做吧，先做名场面重演券」）。
//
// 名场面重演券：吃的是每家自己的历史，同一张券在不同人手里出不同结果。
// 他给你起的称呼：它【会进提示词】，所以抽出来只是候选——她那句
// 「万一我不喜欢这个称号咋办」正是这张卡的设计前提。
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

// ── 名场面重演 ──
test("素材不许灌整段历史——走那道公共的尾巴闸", () => {
  const fn = branch("replay");
  assert.match(fn, /fedTranscript\(lines\.join\("\\n"\)\)/, "聊天那一截没走公共闸");
  assert.match(fn, /\.slice\(-40\)/, "连条数都没拦一道");
  // 记忆库那几条本来就是「值得长期记住的」沉淀，按时间取最近的就够
  assert.match(fn, /\(e\.surfaceState \|\| "active"\) === "active"/, "收起来的记忆也被端上去了");
  assert.match(fn, /\.slice\(0, 14\)/);
  // 什么都没有的时候别硬演
  assert.match(fn, /你俩还没攒下什么可重演的，卡留着/);
});

test("正文和幕后音轨是两段，卡上也分开摆", () => {
  const a = K.askOf("s_replay");
  assert.match(a, /body 和 track 是两个不同的你/);
  assert.match(a, /不许现编一段更好看的/);
  assert.match(branch("replay"), /track: track, where: "replay"/);
  assert.match(scr, /res\.track \? h\("div"/, "幕后音轨没单独摆——混成一段就把落差抹平了");
});

// ── 他给你起的称呼 ──
test("⚠️没点「收下」之前，一个字都不进提示词", () => {
  // 提示词读的是 x_charTitle；兑换那一枪只盖票根（pending）
  assert.match(branch("title"), /where: "title",\s*\n?\s*pending: true/);
  assert.doesNotMatch(branch("title"), /setCharTitleFor/, "抽出来就写进去了——那就不是候选了");
  // 只有「收下／自己改」才写
  const i = app.indexOf("    onGachaTitle: (card, how, custom) => {");
  const fn = app.slice(i, app.indexOf("\n    },", i));
  assert.match(fn, /if \(how === "take" \|\| how === "edit"\)/);
  assert.match(fn, /setCharTitleFor\(c\.id, t0\)/);
  assert.match(fn, /nickname: \(\(charTitleRef\.current/.source ? /setCharTitleFor\(c\.id, ""\)/ : /x/, "「不要」没法把已经收下的撤掉");
  assert.match(app, /nickname: \(\(charTitleRef\.current \|\| \{\}\)\[char\.id\] \|\| \{\}\)\.text \|\| ""/);
});

test("三个口子都在：收下 / 换一个 / 自己改 / 不要，而且收下之后还能反悔", () => {
  ["take", "drop"].forEach(k => assert.match(scr, new RegExp('onTitle\\(card, "' + k + '"'), k));
  assert.match(scr, /onTitle && onTitle\(card, "edit", t0\)/);
  assert.match(scr, /onRedeem\(\{ \.\.\.card, act: "titleAgain" \}\)/);
  assert.match(scr, /res\.where === "title" && res\.taken \? h\("button"/, "收下之后没法反悔");
  // 「换一个」要花钱这件事必须写在脸上（她按次计费）
  assert.match(scr, /「换一个」要再花一次调用/);
  // 换过的那几个别再出同一个
  assert.match(branch("title"), /这几个她没要，换一个别的/);
  // 防重兑那道闸要放行「换一个」
  assert.match(app, /card\.act !== "titleAgain"\) return;/);
});

test("换掉的留一条旧的（跟印象卡改写留修订史同一个形状）", () => {
  const i = app.indexOf("  const setCharTitleFor = (charId, text) => {");
  const fn = app.slice(i, app.indexOf("\n  };", i));
  assert.match(fn, /history: hist/);
  assert.match(fn, /\.slice\(0, 8\)/);
  assert.match(app, /saveJSON\("x_charTitle", n\)/);
});

test("八处一样喂：白送的那条路 + 群聊两处显式补", () => {
  // buildBundle 里那一句＝单聊线上/线下、通话、穿书、匿名箱、解梦馆一起白得
  assert.match(eng, /if \(ctx\.nickname && String\(ctx\.nickname\)\.trim\(\)\) parts\.push/);
  // 群聊两处不走 buildBundle，所以另有一份，而且落在【那位成员自己那一段】里
  assert.match(app, /const nickLineFor = \(charId, uName\) => \{/);
  assert.equal((app.match(/nickLineFor\(/g) || []).length, 2, "群聊两处没都接上");
  assert.match(app, /const both = \[l, nk0\]\.filter\(Boolean\)\.join\("\\n"\);/);
  assert.match(app, /coupleLineFor\(c\.id, userName\(profile\)\), nickLineFor\(c\.id, userName\(profile\)\)\]/);
  // 隐私围栏跟情侣状态同一道：别的成员并不知情
  assert.match(app, /只有 " \+ c\.name \+ " 本人知道/);
});

test("给出口不给判决：不规定他每句都得用（bans-make-it-dumber）", () => {
  // ⚠️只核【真的发出去那一句】，不是扫整个 engine.js——
  //   我自己写在旁边的注释里就有「要多叫她」四个字，扫全文会假红。
  const i = eng.indexOf('if (ctx.nickname && String(ctx.nickname).trim()) parts.push(');
  assert.ok(i > 0);
  const line = eng.slice(i, eng.indexOf(");\n", i));
  assert.match(line, /想用的时候自然用，不必每句都用/);
  assert.doesNotMatch(line, /要多叫她|每次都要叫|一定要用/);
  // 群里那一份措辞跟 engine 保持一致，不是另写一句
  assert.match(app, /这是你自己给她起的称呼，想用的时候自然用，不必每句都用。/);
});
