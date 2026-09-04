// 情侣空间的四处（她 2026-09-04 一口气报的）
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..");
const scr = fs.readFileSync(path.join(root, "js/screens.js"), "utf8");
const app = fs.readFileSync(path.join(root, "js/app.js"), "utf8");
const eng = fs.readFileSync(path.join(root, "js/engine.js"), "utf8");

test("档案页的索引标签：位置＋自身宽度，从形状上就越不过纸的右边缘", () => {
  // 原来是 4 档 × 23%：第四档落在 69%，加上「安慰说明书」那么长的标签就挤到纸外面
  //（她 2026-09-04 截图：04 那一枚顶到右边框外了）。
  assert.match(scr, /const TAB_L = i => \(i % 3\) \* 24;/, "错开的档位变了");
  const L = i => (i % 3) * 24;
  // 判据不是「够不够小」，是【最远那一档 + 它能用的宽度 = 100%】——溢出不可能发生
  assert.match(scr, /maxWidth: "calc\(100% - " \+ TAB_L\(fi\) \+ "%\)"/,
    "标签的可用宽度没跟着位置钉死——标签一长照样溢出");
  assert.match(scr, /marginLeft: TAB_L\(fi\) \+ "%"/);
  for (let i = 0; i < 7; i++) assert.ok(L(i) < 100, "第 " + i + " 档就已经出界了");
  assert.ok(Math.max(...[0, 1, 2, 3, 4, 5, 6].map(L)) <= 48, "最远那一档太靠右，留给标签的位置不够");
  // 缺角那一下要跟着位置走，不能还认死 fi % 4
  assert.match(scr, /borderRadius: TAB_L\(fi\) === 0 \? "0 4px 4px 4px" : 4/, "纸的缺角还认着旧档位");
  assert.doesNotMatch(scr, /\(fi % 4\) \* 23/, "旧那套还留着");
});

test("整页封面留着，但内容自己是一张有边的纸", () => {
  // 她 2026-09-02 要过两次「封面覆盖整页、固定住」——那件事不许退回去。
  assert.match(scr, /className: "h-full flex flex-col", style: \{ position: "relative", background: coverBg \}/,
    "封面不再铺整页了（她要过两次）");
  // 纱只管顶上那一截：收在封面带结束处，不再一路糊到页底
  assert.match(scr, /const veil = "linear-gradient\(180deg,rgba\(0,0,0,\.34\) 0px,rgba\(0,0,0,\.08\) calc\(" \+ ST \+ " \+ 76px\),transparent calc\(" \+ ST \+ " \+ 150px\)\)"/,
    "纱又兼职当内容的底了——那正是「整页糊成一片、纸没有边」的病根");
  assert.doesNotMatch(scr, /bgA\(0\.86\) \+ " calc\("/, "旧那层 .86 收口还在");
  // 纸：圆角上沿 + 向上的投影 = 那条边界；半透明，所以封面照样透着
  const i = scr.indexOf('h("div", { className: "px-6", style: { position: "relative", background: bgA(0.88)');
  assert.ok(i > 0, "内容那一块没做成纸");
  const seg = scr.slice(i, i + 420);
  assert.match(seg, /borderRadius: "26px 26px 0 0"/, "没有上沿的圆角＝看不出是另一层");
  assert.match(seg, /boxShadow: "0 -9px 26px/, "投影朝上才像纸压着封面");
  assert.match(seg, /paddingTop: 46/, "正文没避开压在沿上的那两枚头像");
  // 头像要压在纸沿上：不给 zIndex 会被后画的纸盖掉
  assert.match(scr, /position: "absolute", left: 22, bottom: -30, zIndex: 2/, "两枚头像会被纸盖住");
});

test("如果馆没东西时那句改成「同样的我们」", () => {
  assert.match(scr, /"同样的我们，换掉当初的一样东西"/);
  assert.doesNotMatch(scr, /"同样这两个人，换掉当初的一样东西"/);
});

test("从子页回来不许跳回最上面——而且每一扇门都得走同一个出口", () => {
  // v62.26 起子页也能切子页（愿望板→旅行）：主页没挂着时 bodyRef 是 null，
  // 这时要【保留】记着的位置而不是清成 0——所以只有真拿得到才记。
  assert.match(scr, /const openSub = k => \{ if \(bodyRef\.current\) subScrollRef\.current = bodyRef\.current\.scrollTop; setSub\(k\); \};/,
    "没有「进子页先记位置」这一步（或 null 时又清成 0 了）");
  assert.match(scr, /if \(sub === null && bodyRef\.current && subScrollRef\.current > 0\) bodyRef\.current\.scrollTop = subScrollRef\.current;/,
    "回来时没放回去");
  assert.match(scr, /h\("div", \{ ref: bodyRef, className: "flex-1 min-h-0 overflow-y-auto"/, "滚动容器没挂 ref，记了也放不回去");
  // ⚠️关键：开子页【只能】走 openSub。漏一处就是那一扇门回来会跳顶，而且看不出来。
  // openSub 自己那一行是唯一允许 setSub(k) 的地方，先把它挖掉再数
  const rest = scr.replace(/  const openSub = k => \{[^\n]*\n/, "");
  const opens = rest.match(/setSub\((?!null\))/g) || [];
  assert.equal(opens.length, 0, "还有 " + opens.length + " 处直接 setSub(…) 开子页，那几扇门回来会跳顶");
  assert.ok((scr.match(/openSub\(/g) || []).length >= 10, "开子页的出口数不对，是不是有门没接上");
});

test("我们的档案确实喂进聊天，而且三条路共用一份", () => {
  assert.match(eng, /function coupleArchiveBlock\(text, uName\)/, "档案那一块的领句没了");
  assert.equal((eng.match(/function coupleArchiveBlock/g) || []).length, 1, "抄成了两份");
  // 单聊 buildBundle / 群线上 / 群线下，一处都不许漏（four-surfaces-same-context.md）
  assert.ok((app.match(/coupleArchiveFor\(/g) || []).length >= 2, "群那两条路没接上档案");
  assert.match(eng, /coupleArchiveBlock\(/, "拼好了却没人引用（v55.95 那个形状）");
  // 七栏就是她在界面上写的那七栏，两处不许走散
  assert.match(scr, /\["comfort", "安慰说明书", "难过时想被怎样接住，什么反而会踩雷"\]/);
  assert.equal((scr.match(/const COUPLE_ARCHIVE_FIELDS = \[/g) || []).length, 1);
});
