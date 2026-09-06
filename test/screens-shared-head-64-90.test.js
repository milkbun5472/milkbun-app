// v64.90：她 2026-09-06「宝宝这个共用 head 全部套上去吧，不然以后一堆屎山代码
// 这里改了那里没跟上」。
//
// screens.js 里手写了 29 条顶栏——每一条都自己写一遍安全区、返回键、居中标题、
// 右侧占位。mobile-ui-layout.md §1 那条规矩因此每来一页就要重新想起一次，
// v61.27 已经为这件事把 Head 本身改成紧凑栏了，可存量的这些没跟上。
// v64.87 又多一层：主题工作台的挂点（data-wk）长在 Head 身上，手写的那些一个都抓不住。
//
// 这一版把其中 25 条换成共用 Head，并给 Head 补了三个真的缺的口子。
// 剩下 4 条是【故意不换】的，下面逐条写了理由——不写理由的「以后再说」等于漏。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const JS = path.join(__dirname, "..", "js");
const comp = fs.readFileSync(path.join(JS, "components.js"), "utf8");
const screens = fs.readFileSync(path.join(JS, "screens.js"), "utf8");

test("顶栏的副标题和分隔线不再一律当成【深底白字】", () => {
  const i = comp.indexOf("function Head({");
  const seg = comp.slice(i, comp.indexOf("\n}\n", i));
  // 传了 ink 就假定是夜色页 → 牛皮纸、绿纸论坛那几页的副标题一直是隐形的
  assert.match(seg, /const LIGHT_INK = headInkIsLight\(INK\);/, "没有按 ink 深浅分档");
  assert.match(seg, /const SUB = subInk \|\| \(ink \? \(LIGHT_INK \? "rgba\(255,255,255,\.55\)" : "rgba\(0,0,0,\.42\)"\) : t\.fog\)/);
  assert.match(seg, /const LINE = lineInk \|\| \(ink \? \(LIGHT_INK \? "rgba\(255,255,255,\.14\)" : "rgba\(0,0,0,\.12\)"\) : t\.line\)/);
});

test("亮度判据：认得出六位/三位色号和 rgb()，认不出的退回老样子", () => {
  const i = comp.indexOf("function headInkIsLight(");
  const src = comp.slice(i, comp.indexOf("\n}\n", i) + 2);
  const isLight = new Function(src + "; return headInkIsLight;")();
  assert.equal(isLight("#fff"), true, "白该判成浅");
  assert.equal(isLight("#FFFFFF"), true);
  assert.equal(isLight("#141220"), false, "IF 线那身夜色该判成深");
  assert.equal(isLight("#5d4c31"), false, "抽屉那身牛皮纸的墨该判成深");
  assert.equal(isLight("#273126"), false, "论坛的墨绿该判成深");
  assert.equal(isLight("rgb(250, 248, 244)"), true);
  assert.equal(isLight("rgba(20, 18, 32, .9)"), false);
  // ⚠️主题色不一定是六位色号（mobile-ui-layout.md §3.5 那个坑）：
  //   认不出来的一律当浅色——那正是改这一处之前的老行为，看不懂的颜色不会因此变样
  assert.equal(isLight("var(--ink)"), true, "认不出来的没退回老样子");
  assert.equal(isLight(""), true);
});

test("Head 补的三个口子：页面自己那层材质、副标题色、照片上的字影", () => {
  const i = comp.indexOf("function Head({");
  const seg = comp.slice(i, comp.indexOf("\n}\n", i));
  // ① barStyle：论坛那条毛玻璃、封面那条浮在照片上的，靠它才不用各页再手写一条顶栏
  assert.match(seg, /, barStyle\b/, "barStyle 这个口子没了");
  assert.match(seg, /\}, barStyle \|\| \{\}\)/, "barStyle 没合进外壳的 style");
  // ② subInk / lineInk：页面自己调好过这两档就直接传，别被自动推的那一档冲淡
  assert.match(seg, /, subInk\b/);
  assert.match(seg, /, lineInk\b/);
  // ③ inkShadow：标题浮在一张照片上时得有影，不然遇到亮的那张读不出字
  assert.match(seg, /, inkShadow\b/);
  assert.equal((seg.match(/textShadow: inkShadow \|\| undefined/g) || []).length, 2, "标题和副标题要一起带影");
});

test("screens.js 里换掉的那些顶栏，逐页点名（少一处才红）", () => {
  const want = [
    ['h(Head, { zh: "导入角色卡"', "导入角色卡"],
    ['h(Head, { zh: "人格档案馆"', "人格档案馆"],
    ['h(Head, { zh: initial ? "编辑档案" : "新建档案"', "新建/编辑档案"],
    ['h(Head, { zh: (boardId === "me" ? me : nameOf(boardId)) + " 的关系"', "关系板"],
    ['h(Head, { zh: "世界书"', "世界书"],
    ["h(Head, { zh: title, sub: (!inSub && nav === \"home\") ? \"街坊的告示板\" : \"\"", "论坛"],
    // ⚠️论坛那身雾绿是它自己调好的：不传 subInk/lineInk 就会被自动推的那一档冲成灰
    ["ink: FORUM_SKIN.ink, subInk: FORUM_SKIN.fog, lineInk: FORUM_SKIN.line", "论坛的雾绿副标题与分隔线"],
    ["bg: MSHOP.card, ink: MSHOP.ink, subInk: MSHOP.dim, lineInk: MSHOP.line", "购物那条自己的浅灰"],
    ["const shopHead = (zh, right) => h(Head, {", "购物车/我的（购物）"],
    ['h(Head, { zh: (c.name || "") + " 的亲属卡"', "亲属卡"],
    ['h(Head, { zh: "我们的情书"', "我们的情书"],
    ['h(Head, { zh: "情侣"', "情侣列表"],
    ['h(Head, { zh: char ? (char.remark || char.name) : "日记"', "日记单篇"],
    ['h(Head, { zh: "日记", sub: characters.length > 1', "日记本"],
    ['h(Head, { zh: "写日记"', "写日记"],
    ['h(Head, { zh: "随身物", sub: char.name', "随身物总览"],
    ["h(Head, { zh: sec.zh, sub: char.name", "随身物分栏"],
    ['h(Head, { zh: "随身物", bg: "transparent", noLine: true, onBack })', "随身物盒子"],
    ['h(Head, { zh: "随身物", sub: busyKey === "__all__"', "随身物某人"],
    ['h(Head, { zh: "抽卡"', "抽卡"],
    ['h(Head, { zh: "抽屉"', "抽屉"],
    ['h(Head, { zh: "第一次们"', "第一次们"],
    ['h(Head, { zh: "我的衣柜"', "我的衣柜"],
    ['h(Head, { zh: big ? "" : "照相馆"', "照相馆"],
    ['h(Head, { zh: "和好间"', "和好间"],
    ['h(Head, { zh: "另一种我们"', "另一种我们"],
    ['h(Head, { zh: "我和 " + partner.name', "情侣封面（照片上那条）"],
    // ⚠️封面那条浮在一张真照片上：没有字影，遇到亮的那张就读不出字
    ['inkShadow: "0 1px 6px rgba(0,0,0,.5)", onBack: () => setView(null)', "情侣封面标题的字影"],
    ['barStyle: { position: "relative", zIndex: 2, paddingBottom: 0, height: "calc(" + ST + " + 48px)" }', "情侣封面那条压在封面上的高度与层级"]
  ];
  const miss = want.filter(([needle]) => !screens.includes(needle)).map(([, why]) => why);
  assert.deepEqual(miss, [], "这几页的顶栏掉队了（改回手写的了？）：\n" + miss.join("\n"));
});

test("剩下的手写顶栏只有这四条，而且每条都有理由", () => {
  // 判据：一条顶栏是不是「标准紧凑标题栏」。是 → 必须走 Head。
  // 不是（它本来就是另一样东西）→ 硬塞进 Head 会毁掉那一页的设计，留着。
  const OK = [
    "淘宝那条搜索条：中间是输入框不是标题，Head 的中间只放标题",
    "读信页那行落款：11.5px、字距 2，是信纸上的落款不是标题",
    "写信页那行落款：同上，右边还是「寄出」",
    "IF 线顶栏：标题 + 前提 + 一排进度点共三层，Head 的副标题只有一行"
  ];
  const lines = screens.split("\n");
  const hand = [];
  lines.forEach((ln, i) => { if (/h\(IArrow, \{ size: 19/.test(ln)) hand.push(i + 1); });
  assert.equal(hand.length, OK.length,
    "手写顶栏还剩 " + hand.length + " 条（该是 " + OK.length + " 条）。\n" +
    "多了＝有新写的没走 Head；少了＝上面那四条里有一条被换掉了，把它从名单里删掉。\n" +
    "行号：" + hand.join(", "));
  // 那四条各自的记号，换掉哪一条这里就红
  assert.match(screens, /const topBar = h\("div", \{ className: "shrink-0 px-3 pb-2\.5 flex items-center gap-2"/, "淘宝搜索条");
  assert.equal((screens.match(/letterSpacing: 2, color: inkA\(0\.42\)/g) || []).length, 2, "两页信纸的落款");
  assert.match(screens, /fontSize: 10, color: IF_DIM, marginTop: 1[\s\S]{0,120}line\.premise/, "IF 线那三层顶栏");
});

test("Head 一处挂上，这些页跟着有了主题工作台的挂点", () => {
  // v64.87 起挂点长在 Head 自己身上（跟 Avatar 同一条）。手写的顶栏一个都抓不住，
  // 所以「换成 Head」不只是省代码，是这些页第一次能被页面 CSS 抓住。
  const i = comp.indexOf("function Head({");
  const seg = comp.slice(i, comp.indexOf("\n}\n", i));
  assert.match(seg, /"data-wk": "head"/);
  assert.equal((seg.match(/"data-wk": "headink"/g) || []).length, 3, "返回键/标题/右侧三处挂点");
  assert.match(seg, /"data-wk": "headdim"/);
});
