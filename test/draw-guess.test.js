const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const src = fs.readFileSync(path.join(__dirname, "..", "js", "games.js"), "utf8");
const i = src.indexOf("  const DRAW_POOL_KEY"), j = src.indexOf("  function drawHit(");
const drawStrokePath = new Function(src.slice(i, j) + "\nreturn drawStrokePath;")();
const G = src.slice(src.indexOf("  function DrawGuessGame(props) {"), src.indexOf("  function UnoGame(props) {"));

// 她 2026-10-11：你画我猜——TA 分段画、每段吐槽一句；段数 TA 自己定；词库按主题一批生成；轮流三轮
test("模型写的笔画转成 svg，坏的一笔丢掉、坐标夹在画布里", () => {
  assert.equal(drawStrokePath({ t: "line", p: [0, 0, 50, 50] }), "M0 0L50 50");
  assert.match(drawStrokePath({ t: "circle", c: [50, 50, 10] }), /^M40 50a10 10/);
  assert.equal(drawStrokePath({ t: "line", p: [0, 0, 500, -9] }), "M0 0L100 0");
  assert.equal(drawStrokePath({ t: "line", p: [1] }), "");
  assert.equal(drawStrokePath({ t: "line", p: ["x", 1, 2, 3] }), "");
  assert.equal(drawStrokePath(null), "");
});

test("TA 画：一次调用拿整幅，分段放、每段一句；空着按是接着画，不调模型", () => {
  assert.match(G, /分几段你自己定（2 到 5 段）/);
  assert.match(G, /\{\\"segments\\":\[\{\\"strokes\\":\[\.\.\.\],\\"say\\":\\"一句\\"\}\]\}/);
  // 一口气模式「接着画」只放下一段，不调模型；一段一段模式才每段问一次（nextSeg 那一行分开）
  assert.match(G, /if \(hasMore\(\)\) \{ nextSeg\(\); return; \}/);
  assert.match(G, /if \(drawHit\(v, word\)\) \{ finishTurn\(true, "me"\); \}/, "猜中要代码判");
});

test("她画：画布转成图给 TA 看；词库按主题一批生成、存进大仓库", () => {
  assert.match(G, /imageDataUrls: \[toPng\(\)\]/);
  assert.match(src, /const DRAW_POOL_KEY = "x_drawWords";/);
  assert.match(G, /saveDrawPool\(n\)/);
  assert.match(G, /const totalTurns = \(watchOnly && !duo\) \? DRAW_ROUNDS : DRAW_ROUNDS \* 2;/, "不是轮流");
  assert.match(src, /if \(session\.game\.key === "draw"\) return h\(DrawGuessGame, engineProps\);/);
});

// 她 2026-10-11：「观战模式不能看两个角色你画我猜吗」
test("观战两个角色：轮流画猜；猜的人读笔画不看图、不知道答案；她能抢答", () => {
  assert.match(G, /const duo = !!\(watchOnly && char && char2\);/);
  assert.match(G, /const guesser = duo \? \(turn % 2 === 0 \? char2 : char\) : null;/);
  const look = G.slice(G.indexOf("const guesserLook"), G.indexOf("const sendWhileTaDraws"));
  assert.match(look, /describeSegs\(segs, shown\)/, "猜的人没在读画");
  assert.ok(look.indexOf("word +") < 0 && look.indexOf("「\" + word") < 0, "把答案递给猜的人了");
  assert.ok(look.indexOf("imageDataUrls") < 0, "观战猜不该要识图");
  assert.match(G, /if \(drawHit\(v, word\)\) \{ finishTurn\(true, "me"\); return; \}/, "她抢答没算");
});

// 她 2026-10-12 截图：「(games) undefined is not an object (evaluating 'pts.map')」
test("手指画：setState 里不读会被清空的 ref，坏的一笔不让画布崩", () => {
  const mv = G.slice(G.indexOf("const onMove = function"), G.indexOf("const onUp = function"));
  assert.match(mv, /const cur = curStroke\.current; if \(!cur\) return;/);
  assert.ok(mv.indexOf("Object.assign({}, curStroke.current)") < 0, "又在更新函数里读 curStroke.current 了");
  assert.match(G, /myStrokes\.filter\(function \(s\) \{ return s && Array\.isArray\(s\.pts\) && s\.pts\.length; \}\)\.map/);
});
// 她 2026-10-12：「我和他单独各自一边气泡像讲话不要全部塞一起」「根据人设水平有时候故意画丑一点」
test("对话一句一个气泡、她在右；五子棋和你画我猜共用一个；画得丑不丑照人设", () => {
  assert.equal((src.match(/h\(GameTalkLog, \{/g) || []).length, 7, "心有灵犀、五子棋、你画我猜、25 问（我出题／TA 出题）、俄罗斯方块、走子棋公共页（国际象棋·中国象棋·斗兽棋，v76.772 起一张）、围棋共用这一份");
  assert.match(src, /"data-wk": "gametalkrow", "data-me": "1", style: \{ display: "flex", justifyContent: "flex-end"/);
  assert.match(G, /照你人设里的画画水平来/);
});

// 她 2026-10-12：你画我猜也做成「每一段用 TA 的 api 想」
test("一段一段想：每段一次调用，看得到已画的和她说过的；画几段边画边定", () => {
  assert.match(src, /drawBrain: game\.key === "draw" \? drawBrain : undefined/);
  const st = G.slice(G.indexOf("const stepSeg = async function"), G.indexOf("const hasMore = function"));
  assert.match(st, /describeSegs\(have, have\.length\)/, "看不到自己已经画了什么");
  assert.match(st, /said\(\)/, "看不到她说过什么");
  assert.match(st, /\{\\"strokes\\":\[\.\.\.\],\\"say\\":\\"一句\\",\\"done\\":false\}/);
  assert.match(G, /const nextSeg = function \(\) \{ if \(stepMode\) stepSeg\(word, drawer, segs\); else showSeg\(segs, shown\); \};/);
  assert.match(G, /if \(stepMode\) \{ setSegs\(\[\]\); setShown\(0\); setStepDone\(false\); return stepSeg\(w, who, \[\]\); \}/);
});

{
  const g = require("fs").readFileSync(require("path").join(__dirname, "..", "js", "games.js"), "utf8");
  const seg = g.slice(g.indexOf("// 你画我猜（她 2026-10-11）"), g.indexOf("// 你画我猜（她 2026-10-11）") + 30000);
  require("node:assert").ok(!/AC \+ VOICE_RULE \+ persona\(/.test(seg), "你画我猜要走 gameVoiceRules（跟别的游戏同一份说话规矩）");
  require("node:assert").match(g, /persona: gameSheet\(c\) \+ \(lore \?/, "人设整张读（入局时统一填）");
}
