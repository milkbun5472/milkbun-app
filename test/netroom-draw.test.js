// 联机你画我猜（她 2026-11-24）：轮流画、一段一段画、每段大家按顺序各猜一次；题目只给画的人；公开那份不带答案
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const path = require("node:path");
const read = f => fs.readFileSync(path.join(__dirname, "..", f), "utf8");
const gsrc = read("js/netroom-games.js"), games = read("js/games.js"), nsrc = read("js/netroom.js");

function load() {
  const w = { loadJSON: (k, d) => d, saveJSON: () => {} };
  new Function("window", gsrc)(w);
  w.GameShared = { draw: { path: () => "M0 0L1 1", describe: () => "画", hit: (g, word) => g === word, INK: { k: "#000" }, BUILTIN: ["猫", "狗", "伞", "灯", "鱼", "车"], pool: () => ({ words: [] }), STROKE_FMT: "" } };
  return w.NetGameCore.ADAPTERS.draw;
}
const inv = n => ({ seats: Array.from({ length: n }, (_, i) => ({ kind: "user", peer: "P" + i, name: "人" + i })) });
const seg = { strokes: [{ t: "line", p: [1, 1, 50, 50], k: "r" }], say: "嗯" };

test("开局：两个人各画三张；题目只发给画的人，猜的人拿到空的一份（角色才不会一直等）", () => {
  const A = load(), I = inv(2), st = A.init(I, {});
  assert.strictEqual(st.total, 6);
  assert.strictEqual(A.turn(st), 0);
  assert.ok(A.priv(st, 0).word);
  assert.deepStrictEqual(A.priv(st, 1), {});
  assert.ok(!JSON.stringify(A.cleanView(A.view(st))).includes(st.word), "公开那份不许带答案");
});

test("画一段 → 别人按顺序猜；没中回去接着画；画完了还没人中就揭晓、换下一个人画", () => {
  const A = load(), I = inv(3), ctx = { inv: I };
  let st = A.init(I, {});
  st = A.apply(st, 0, seg, ctx).st;
  assert.strictEqual(st.phase, "guess"); assert.strictEqual(A.turn(st), 1);
  assert.ok(A.apply(st, 0, { guess: "x" }, ctx).err, "没轮到的不收");
  st = A.apply(st, 1, { guess: "不对" }, ctx).st; assert.strictEqual(A.turn(st), 2);
  st = A.apply(st, 2, { guess: "" }, ctx).st;
  assert.strictEqual(st.phase, "draw"); assert.strictEqual(A.turn(st), 0);
  const w = st.word;
  st = A.apply(st, 0, Object.assign({ done: true }, seg), ctx).st;
  const before = st;
  st = A.apply(st, 1, { guess: "还不对" }, ctx).st;
  st = A.apply(st, 2, { guess: "也不对" }, ctx).st;
  assert.strictEqual(st.history.length, 1); assert.strictEqual(st.history[0].ok, false); assert.strictEqual(st.history[0].word, w);
  assert.strictEqual(st.drawer, 1); assert.strictEqual(st.segs.length, 0);
  assert.match(A.roundEnd(before, st), /没人猜中/);
});

test("猜中：猜的人和画的人各一分，直接换下一张；收满张数结束出战绩", () => {
  const A = load(), I = inv(2), ctx = { inv: I };
  let st = A.init(I, {});
  st = A.apply(st, 0, seg, ctx).st;
  st = A.apply(st, 1, { guess: st.word }, ctx).st;
  assert.deepStrictEqual(st.scores, [1, 1]); assert.strictEqual(st.history[0].by, "人1");
  st = A.apply(st, 1, { giveup: true }, ctx).st;
  assert.strictEqual(st.history.length, 2);
  st = A.apply(st, 0, { end: true }, ctx).st;
  const r = A.result(st, I);
  assert.deepStrictEqual(r.winners, [0, 1]);
  assert.match(r.text, /猜中/);
});

test("一笔的白名单：坐标夹在画布里、颜色认不得当黑、空的一段不收", () => {
  const A = load(), I = inv(2), ctx = { inv: I };
  const st = A.init(I, {});
  assert.ok(A.apply(st, 0, { strokes: [{ t: "bad" }] }, ctx).err);
  const n = A.apply(st, 0, { strokes: [{ t: "line", p: [-5, 200, 30, 30], k: "zz", evil: 1 }] }, ctx).st;
  assert.deepStrictEqual(n.segs[0].strokes[0], { t: "line", p: [0, 100, 30, 30], k: "k", f: false, close: false });
});

test("联机开局页人数上限照联机那一桌；单机你画我猜那几样搬进 GameShared.draw 共用", () => {
  assert.match(nsrc, /setupGame: g =>/);
  assert.match(games, /game: props\.setupGame \? props\.setupGame\(game\) : game/);
  assert.match(games, /draw: \{ path: drawStrokePath, describe: drawDescribe, hit: drawHit/);
  assert.match(games, /const describeSegs = drawDescribe;/);
});
