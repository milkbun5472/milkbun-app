const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const th = fs.readFileSync(path.join(__dirname, "..", "js/theater.js"), "utf8");

// v54.46（她 2026-08-22）：封面点了没提示、画完看不到整张、也进不了图库。
// 三件事一起治：说清楚在画什么 / 画完接管背景 / 归档进图库能存相册。

test("出图前先说话：封面和剧照都报出在画什么，不再顶着「Ta 在演…」", () => {
  assert.match(th, /const \[busyWhat, setBusyWhat\] = useState\(""\)/);
  assert.match(th, /setBusyWhat\("正在画封面…出图慢，别退出这一页"\)/);
  assert.match(th, /setBusyWhat\("正在画这一拍的剧照…"\)/);
  assert.match(th, /props\.toast\("开始画封面了，出图要等一会儿…", 6000\)/, "+ 菜单一收就没反馈，得留一句 toast");
  assert.match(th, /busyWhat \|\| "Ta 在演…"/, "演出页那行字要跟着 busyWhat 走");
  // 两条路都要把标签清掉，否则下一次真的在演时还挂着「正在画封面」
  assert.equal((th.match(/setBusy\(false\); setBusyWhat\(""\)/g) || []).length, 2);
});

// 接管背景的判定是这次的核心：既要让封面真的看得见，又不能把她自己传的背景冲掉。
// 把那段判定原样抠出来跑，别只验源码里有没有那行字。
const takeBg = (l, cover) => {
  const take = !l.bg || l.bg === l.cover;
  return { bg: take ? cover : l.bg, took: take };
};
test("封面接管背景：空背景接管、旧封面跟着换、她自己传的背景不许动", () => {
  assert.deepEqual(takeBg({ bg: null, cover: null }, "iv_new"), { bg: "iv_new", took: true });
  // 背景本来就是上一版封面 → 跟着新封面走
  assert.deepEqual(takeBg({ bg: "iv_old", cover: "iv_old" }, "iv_new"), { bg: "iv_new", took: true });
  // 她自己传的背景（和封面不是同一张）→ 一个字不动
  assert.deepEqual(takeBg({ bg: "iv_mine", cover: "iv_old" }, "iv_new"), { bg: "iv_mine", took: false });
  assert.deepEqual(takeBg({ bg: "iv_mine", cover: null }, "iv_new"), { bg: "iv_mine", took: false });
  // 源码里就是这一条判定，别哪天被改成无条件覆盖
  assert.match(th, /const take = !l\.bg \|\| l\.bg === l\.cover;/);
  assert.match(th, /bg: take \? ref : l\.bg/);
});

test("封面归档进图库，能看整张也能存相册", () => {
  assert.match(th, /saveGal\(list => \[\{ id: rid\("tg_"\), charId: line\.charId, lineId: line\.id, lineTitle: line\.title, img: ref, ts: Date\.now\(\), kind: "cover" \}\]/);
  // 以前出过的封面也要一次性补进去，不然老线的封面永远看不到整张
  assert.match(th, /lines\.forEach\(l => \{ if \(l\.cover && !have\.has\(l\.cover\)\)/);
  assert.match(th, /kind: "cover" \}\); \} \}\);/);
  assert.match(th, /x\.kind === "cover" \? h\("div"/, "图库缩略图要能跟剧照分得开");
});

test("大图查看器搬出图库分支，演出页也能点开看整张", () => {
  assert.match(th, /const bigViewer = \(\) => galView && h\("div"/);
  assert.match(th, /const viewer = bigViewer\(\);/, "图库分支改成复用同一个");
  // 只能有一处定义：搬完还留着旧的那份就等于又分了叉
  assert.equal((th.match(/galView && h\("div", \{ onClick: \(\) => setGalView\(null\)/g) || []).length, 1);
  assert.match(th, /maxHeight: "72vh", borderRadius: 10, objectFit: "contain"/, "看的是整张，不是裁过的");
  assert.match(th, /🔍 看封面整张/);
  assert.match(th, /🖼 封面当背景/);
  // 演出页点开的封面若还没归档，删除按钮不能哑火
  assert.match(th, /if \(!gal\.some\(x => x\.id === id\)\) return props\.toast\("这张还没归档进图库"\)/);
});
