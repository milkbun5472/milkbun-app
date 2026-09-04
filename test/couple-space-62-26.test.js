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

// ── v62.40（她 2026-09-04：「这两个从这里开始和和好馆的外观也好无聊改一改吧」）──
// 判据照 .claude/rules/tabs-not-plain-pills.md：**原样搬去另一个 app 还成立吗**。
// 上一版两格都成立——一块紫色渐变圆角卡、一个换了底色的圆角框，任何 app 都能用，
// 所以它们没有从「这一格是什么东西」里长出来。
// 这一整页是【一面墙】（底下贴着拍立得、票根、软木板），那么：
//   时间轴与纪念日 → 一本挂历；他没说出口的那一半 → 一张折起来的字条。
test("「今天」那一格是一页挂历，不是一块渐变卡", () => {
  assert.doesNotMatch(scr, /linear-gradient\(155deg,#7d3f57 0%,#5b2f46 62%,#4a2739 100%\)/,
    "旧那块紫渐变还在——撤掉东西要删掉，不是留在原地");
  // 挂历页凭这几样才是挂历：跨过顶边的铁环、打穿红头的孔、月份红头、撕线
  assert.match(scr, /const calRing = left =>/, "铁环没了");
  assert.match(scr, /const calHole = left =>/, "挂孔没了");
  assert.match(scr, /calRing\("33%"\), calRing\("67%"\)/);
  assert.match(scr, /calHole\("33%"\), calHole\("67%"\)/);
  // ⚠️百分比定位不许再做算术：left 是 "33%" 时 `left + 1` 会拼成 "33%1"，
  //   那是个废值，浏览器静默丢掉、孔全塌回最左边（第一版就这么坏的，静默、不报错）。
  assert.doesNotMatch(scr, /left: left \+ 1/, "百分比又被拿去做加法了");
  assert.match(scr, /const CAL_M = bAnn && bAnn\.month \? Number\(bAnn\.month\) : _cal\.getMonth\(\) \+ 1;/,
    "红头上的月份要跟着那个纪念日走，没纪念日才用本月");
  // 挂历页也是方角的：22 的大圆角就是回到那块通用卡了
  assert.match(scr, /borderRadius: "4px 4px 2px 2px",\s*\n?\s*background: "#fdf8ee"/, "挂历页的角被改圆了");
});

test("和好间那一格是一张折起来的字条，而且平静时不许折", () => {
  const seg = scr.slice(scr.indexOf("// ── 和好间：一张折起来的字条"), scr.indexOf('eyebrow("墙上"'));
  assert.ok(seg.length > 400 && seg.length < 4000, "取到的那一段不对");
  assert.match(seg, /const lit = !!\(mkSig\.on \|\| mkCur\);/);
  // 折角：纸角真的被切掉一块（clipPath），翻起来那一小片另画
  assert.match(seg, /clipPath: lit \? "polygon\(0 0, calc\(100% - " \+ EAR/, "折角没了");
  assert.match(seg, /clipPath: "polygon\(0 0, 100% 100%, 0 100%\)"/, "翻起来那一小片没了");
  // 折痕在【底边】：横在正文上面的话读起来是两个方块摞着，正是要躲开的长相
  assert.match(seg, /bottom: 0, height: 11/, "底边那道折没了");
  assert.doesNotMatch(seg, /top: 30,\s*\n?\s*borderTop/, "折痕又跑回正文上面了");
  // 没事的时候就是一张没折过的平纸：不许有折角、不许压阴影
  assert.match(seg, /transform: lit \? "rotate\(-0\.7deg\)" : null/);
  assert.match(seg, /boxShadow: lit \? "0 11px 24px rgba\(120,70,60,\.15\)" : "none"/);
  // 点得着：不管长成什么形状，可点区域不低于 44
  assert.match(seg, /minHeight: 44/, "可点区域没了（tabs-not-plain-pills 那两条不许牺牲的之一）");
  // 纸是方角的。这一条专挡「改回一颗药丸」——变异测试里就它一个能活下来。
  assert.match(seg, /borderRadius: 2, padding: lit \?/, "字条的角被改圆了——那就又是一颗药丸");
});
