const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..");
const scr = fs.readFileSync(path.join(root, "js/screens.js"), "utf8");
const app = fs.readFileSync(path.join(root, "js/app.js"), "utf8");
const board = scr.slice(scr.indexOf("function TiesBoard("), scr.indexOf("function Ties({"));
const photo = scr.slice(scr.indexOf("function TiePhoto("), scr.indexOf("function TiesBoard("));
const ties = scr.slice(scr.indexOf("function Ties({"), scr.indexOf("function RelComposer("));

// 她 2026-09-02：「我是想每个角色都有自己的页面，我的汇总页可以不要」
//               ＋「有些字段太长了看不完还会插入别的」

test("一人一页：这一页只画和中心那个人直接有关系的", () => {
  assert.match(board, /function TiesBoard\(\{ centerId,/);
  assert.match(board, /if \(f !== centerId && g !== centerId\) return;/,
    "不筛的话又是那张所有人挤一起的网");
  // 老那份「所有人画一张网」整个删掉，不留半截
  assert.ok(!scr.includes("function TiesMap("), "v60.46 那张汇总网还留着");
  assert.ok(!scr.includes("const tethers = npcs.map"), "汇总网那套配角虚线也一起走");
  assert.match(ties, /h\(TiesBoard, \{\n?\s*key: boardId, centerId: boardId/, "换人要真的换一页");
});

test("标签只取中心这一头的说法——两头拼一句就是那行横穿全图的字", () => {
  // v60.46：fwd.label + " · " + bwd.label，两边都写得长的时候那一行能盖住别人的脸
  assert.ok(!/\+ " · " \+ \(bwd\.label/.test(board), "又把两头拼起来了");
  assert.match(board, /const e = out \|\| inc;/);
  assert.match(board, /label: \(e && e\.label\) \|\| ""/);
  // 对方那头写得不一样时不是丢掉，是收进详情里
  assert.match(board, /backLabel: out && inc &&/);
});

test("牌子一行、有最大宽度、超了就截", () => {
  assert.match(scr, /const TIE_LABEL_MAX = \d+;/);
  const ti = board.indexOf("links.filter(L => L.label)");
  const tag = board.slice(ti, board.indexOf(".map(card)", ti));
  assert.ok(ti > 0 && tag.length > 200, "切片没对上");
  assert.match(tag, /maxWidth: TIE_LABEL_MAX/);
  assert.match(tag, /textOverflow: "ellipsis"/, "不截就是她报的「看不完还会插入别的」");
  assert.match(tag, /whiteSpace: "nowrap"/);
});

test("截掉的那半在选中面板里看得全，连对方那头怎么写的也看得见", () => {
  const pan = board.slice(board.indexOf("selLink ? h("));
  assert.match(pan, /selLink\.label/);
  assert.match(pan, /selLink\.note/);
  assert.match(pan, /nameOf\(selLink\.other\) \+ "那头写的"/);
  assert.match(pan, /whiteSpace: "pre-wrap"/, "整句要能换行，不然又是一条横线");
  assert.match(pan, /onEditEdge\(centerId, selLink\.other\)/);
});

test("牌子挂在两张照片中间那段空当，不是两个圆心的正中", () => {
  // 圆心正中会落在中间那张大照片里头，牌子直接被压住看不见
  assert.match(board, /const halfOf = id =>/);
  assert.match(board, /const at = Math\.max\(ra \+ 6, Math\.min\(len - rb - 6, ra \+ \(len - ra - rb\) \/ 2\)\)/);
  assert.match(board, /thread\(P\(centerId\), P\(L\.other\), halfOf\(centerId\), halfOf\(L\.other\)\)/);
});

test("切人是一排脸，不是一排药丸", () => {
  // tabs-not-plain-pills：这个 app 里认人靠脸不靠名字，换个 app 这条不成立
  assert.match(ties, /const faceStrip = h\("div"/);
  assert.match(ties, /filter: on \? "none" : "grayscale\(0\.7\)"/, "选中/没选中不能只差一个填色");
  assert.match(ties, /width: on \? 46 : 34/, "形状和大小也要变，不能只靠色差");
  assert.ok(!/borderRadius: 999/.test(ties.slice(ties.indexOf("const faceStrip"), ties.indexOf("const nBoard"))),
    "别做成药丸");
});

test("照片是钉上去的：歪一点点，而且每次都歪同一个角度", () => {
  assert.match(scr, /const tieTilt = id => \{/);
  assert.match(scr, /for \(let i = 0; i < String\(id\)\.length/, "按 id 定死，不许每次渲染换一个（那就是抖动）");
  assert.match(photo, /transform: "rotate\(" \+ tilt \+ "deg\)"/);
  assert.match(board, /tilt: id === centerId \? 0 : tieTilt\(id\)/, "中心那张摆正");
});

test("v60.46 那三条只有真跑才抓得到的防御，一条都不许掉", () => {
  // 1. <img> 会被浏览器当成拖图片，直接 pointercancel 掐掉手势
  assert.match(photo, /WebkitUserDrag: "none"/);
  assert.match(photo, /WebkitTouchCallout: "none"/);
  assert.match(photo.slice(photo.indexOf("pointerEvents: \"none\"")), /^pointerEvents: "none", width: size/);
  // 2. 松手要从 ref 读实时值，不是渲染闭包
  assert.match(board, /p\.live = \{ x: cur\.x \+ dx \/ k/);
  assert.match(board, /onSavePos\(key\(p\.node\), p\.live\)/);
  // 3. 节点不是内联组件
  assert.ok(!/const [A-Z]\w* = \(\{ id, kind \}\) =>/.test(board));
  assert.match(board, /const card = id => \{/);
});

test("摆位按【谁的板子】分开存，两页互不干扰", () => {
  assert.match(board, /const key = id => centerId \+ "\|" \+ id;/);
  assert.match(board, /const P = id => saved\[key\(id\)\]/);
  assert.match(board, /x\.indexOf\(centerId \+ "\|"\) === 0/, "「她拖过没有」也要只看这一页");
  assert.match(app, /saveJSON\("x_tiesPos", n\)/);
});

test("⌖ 只归位视野，不许顺手清掉她摆好的位置", () => {
  assert.match(board, /const recenter = \(\) => \{ setSel\(null\); fitNow\(\); \}/);
  assert.match(board, /\["⌖", recenter\]/);
  assert.match(board, /moved \? \[\["⟲", resetLayout\]\] : \[\]/);
});

test("整页 + 紧凑标题栏，配角简介的入口没丢", () => {
  assert.ok(!/h\(Sheet,/.test(board), "不许用半窗");
  assert.match(ties, /paddingTop: safeTop\(10\)/);
  assert.ok(!/h\(Head, \{\n?\s*zh: "关系"/.test(ties), "Head 那个大标题要吃掉三百多像素");
  assert.match(board, /className: "flex-1 min-h-0"/);
  assert.match(board, /touchAction: "none"/);
  // 配角没有自己的资料页，读全文/改/删只能落在按条看那一页（她 2026-08-25 定的）
  assert.match(ties, /"按条看 · 改配角简介 ›"/);
  assert.match(ties, /h\(NpcBrief, \{ npc: npc/);
});
