// 片刻加料（她 2026-10-08）：错过的直播看高光、评论区有后续、拉 TA 一起看
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const live = fs.readFileSync(path.join(__dirname, "../js/live.js"), "utf8");
const shua = fs.readFileSync(path.join(__dirname, "../js/shua.js"), "utf8");

function liveKit() {
  const win = {};
  const fn = new Function("window", "h", "Svg", "useState", "useEffect", "useRef", "loadJSON", "saveJSON", live + "\nreturn window.LiveKit;");
  return fn(win, () => null, () => null, () => [null, () => {}], () => {}, () => ({}), () => [], () => {});
}
function between(src, a, b) { const i = src.indexOf(a); assert.ok(i >= 0, a); const j = src.indexOf(b, i + a.length); assert.ok(j > i, b); return src.slice(i, j); }

test("错过的那场：点了才剪高光，剪好存成已下播的回放", () => {
  const K = liveKit();
  const ins = K.recapInstruction({ start: new Date(2026, 9, 7, 20).getTime(), end: new Date(2026, 9, 7, 21).getTime(), kind: "sing" }, "她");
  assert.match(ins, /没来看/);
  assert.match(K.RECAP_SHAPE, /"flow"/);
  const fn = between(live, "const recap = async", "\n    };");
  assert.match(fn, /recap: true/);
  assert.match(fn, /endTs: x\.end/);
  assert.match(fn, /slotId: x\.id/);
  const missed = between(live, "const missed =", ";\n");
  assert.match(missed, /selfLive === false/, "关了自己开播就不列");
  assert.match(missed, /slotId === x\.id/, "进去过或剪过的不再列");
  assert.match(live, /data-wk": "liverecap"/);
});

test("评论区有后续：同一枪写 thread，有来有回才记一条记忆", () => {
  assert.match(shua, /const THREAD_ADD = /);
  assert.match(between(shua, "const shapeChar =", "\n"), /THREAD_ADD/);
  const blk = between(shua, "const th = d.thread", "names.push");
  assert.match(blk, /replies/);
  assert.match(blk, /S\(th\.back\) && props\.remember/);
  assert.match(between(shua, "function CommentsPage(", "\n  }\n"), /c\.replies/, "竖着刷的评论页也看得到回复");
});

test("拉 TA 一起看：只有横着看有；卡里带简介和弹幕，不额外调用", () => {
  const win = {};
  const K = new Function("window", "h", "loadJSON", "saveJSON", "uid", shua + "\nreturn window.ShuaKit;")(win, () => null, () => null, () => {}, p => p + "1");
  const v = { id: "a", author: "x", scene: "s", caption: "", tags: [], skin: "b", intro: "简介在这", dur: "08:24", dms: ["哈哈", "前排"], likes: 1 };
  const plain = K.shareText(K.shareSnap(v), null, "");
  assert.doesNotMatch(plain, /一起看/);
  const tog = K.shareText(K.shareSnap(Object.assign({}, v, { together: true })), null, "");
  assert.match(tog, /一起看/);
  assert.match(tog, /简介在这/);
  assert.match(tog, /前排/);
  const page = between(shua, 'page.kind === "share"', 'page.kind === "refresh"');
  assert.match(page, /vidSkin\(v\) === "b"/);
  assert.doesNotMatch(page, /callAI|runProbe|replyNow|props\.ask\(/);
});

test("刷什么他知道：本机数点赞，同一话题够三条才有一句，只给片刻上有号的", () => {
  const K = new Function("window", "h", "loadJSON", "saveJSON", "uid", shua + "\nreturn window.ShuaKit;")({}, () => null, () => null, () => {}, p => p + "1");
  const now = Date.now();
  const vids = n => Array.from({ length: n }, (_, i) => ({ id: "v" + i, by: "npc", liked: true, likedTs: now, tags: ["猫"] }));
  assert.equal(K.tasteLine({ videos: vids(5), accounts: {} }, "c1"), "", "没号看不见");
  assert.equal(K.tasteLine({ videos: vids(2), accounts: { c1: { handle: "x" } } }, "c1"), "");
  assert.match(K.tasteLine({ videos: vids(3), accounts: { c1: { handle: "x" } } }, "c1"), /猫/);
  const old = vids(3).map(v => Object.assign(v, { likedTs: now - 30 * 86400000 }));
  assert.equal(K.tasteLine({ videos: old, accounts: { c1: { handle: "x" } } }, "c1"), "", "一周以前的不算");
  const app = fs.readFileSync(path.join(__dirname, "../js/app.js"), "utf8");
  const eng = fs.readFileSync(path.join(__dirname, "../js/engine.js"), "utf8");
  assert.match(app, /shuaTaste: \(\(\) =>/);
  assert.match(eng, /ctx\.shuaTaste/);
});

test("本周礼物榜本机算；热门里有同款挑战、TA 发视频时读得到模板", () => {
  const rank = between(live, "const weekRank =", "})();");
  assert.match(rank, /7 \* 86400000/);
  assert.doesNotMatch(rank, /probe|ask\(/);
  assert.match(live, /data-wk": "liverank"/);
  assert.match(shua, /同款的挑战/);
  assert.match(between(shua, "const hotToday =", "\n"), /x\.about/);
});

test("追更：系列出新一期落一条消息；串门：叫自己的人一起看路人主播", () => {
  const post = between(shua, "// 追更（她 2026-10-08）", "names.push");
  assert.match(post, /me \|\| \{\}\)\.series/);
  assert.match(post, /note\(/);
  assert.match(shua, /data-wk": "shuaseriesfollow"/);
  assert.match(live, /const invite = c =>/);
  assert.match(live, /onInvite: cur\.stranger \? invite : null/);
  assert.match(live, /ses\.buddy && x\.who === ses\.buddy\.name/);
  assert.match(between(live, "if (s.buddy) {", "stPatch("), /props\.remember\(\[s\.buddy\.charId\]/);
});
