const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
// 规则原文只从这一处拿（路径写在 test/_rules.js 那一行，搬家改一处就够）
const { ruleText } = require("./_rules.js");
const R = f => fs.readFileSync(path.join(__dirname, "..", "js", f), "utf8");
const dwell = R("dwell.js"), comp = R("components.js");

function load() {
  const store = {}; const w = {};
  new Function("loadJSON", "saveJSON", "window", "useTheme", "useState", "useEffect", "h", "Head", "Empty", "Sheet",
    "Spinner", "Eyebrow", "IArrow", "IRefresh", "ITrash", "Avatar", "pageSkin", "safeTop", "F_BODY", "F_DISPLAY",
    "generateSelfieImage", "blobToDataUrl", "imgToVault", "imgApiReady", "resolveImg", dwell)(
    (k, d) => store[k] !== undefined ? JSON.parse(JSON.stringify(store[k])) : d,
    (k, v) => { store[k] = JSON.parse(JSON.stringify(v)); }, w,
    () => ({}), () => [null, () => {}], () => {}, () => null, null, null, null, null, null, null, null, null, null,
    () => ({}), () => "", "", "", async () => ({ blob: {} }), async () => "data:,", async () => "iv_x", () => true, x => x);
  return { D: w.Dwell, store };
}

// 她 2026-09-01：「codex 修了一下去处因为旧 ui 太像别人的了，但是去掉了全屏观看，
// 然后改了一下还是治标不治本」。
//
// 旧 UI（照片上挂悬浮胶囊＋连线＋幽灵英文）确实是别处见惯的样子；
// 但换上来的「场所观察档案」是同一个病换个皮：场所观察档案／空间索引／区域 01／
// 现场视图／物件观察卡／外观与来路——这一整套【原样搬进房产 app、勘察 app、
// 库存 app、博物馆目录都成立】，按 tabs-not-plain-pills.md 的判据就是没设计。
// 而且它把他的家说成了证物，正好毁掉这个功能唯一的用处。
//
// 治本＝换【那个东西】，不是换摆放：去处在现实里是串门，所以
//   一处地方＝你站在那儿看见的一屏（点图＝真全屏）；
//   一块区域＝他把东西摆在哪儿，长成一条台面；
//   一件东西＝你拿起它，然后听见他心里那句，那句是这一页唯一的主角。
test("全屏观看要回来，而且全屏就只有图", () => {
  const i = dwell.indexOf("const fullShot =");
  assert.ok(i > 0, "全屏看图整个没了——她 2026-09-01 点名要回来的就是这个");
  const v = dwell.slice(i, dwell.indexOf("document.body) : null;", i));
  assert.match(v, /position: "fixed", inset: 0/, "不是铺满屏幕");
  assert.match(v, /objectFit: "contain"/, "全屏还在裁图，看不到整张");
  assert.match(v, /onClick: function \(\) \{ setShot\(""\); \}/, "点一下退不出来");
  // 全屏＝只有图：不许再压标题、氛围、统计条上去
  assert.ok(v.indexOf("p.name") < 0 && v.indexOf("ambient") < 0 && v.indexOf("linear-gradient") < 0,
    "全屏上又压了东西——那就不叫全屏观看了");
  // fixed 会锚到带 transform 的祖先上，所以必须 portal 出去
  assert.match(v, /ReactDOM\.createPortal/, "没 portal 出去，外面几层有 transform，会锚歪");
  // 两处有图的地方都点得开，而且真的挂进了页面
  assert.match(dwell, /const placeHero = function \(p, zs\) \{[\s\S]{0,700}setShot\(src\)/, "整屏那张点不开");
  assert.match(dwell, /const placePhoto = function \(p, height\) \{[\s\S]{0,300}setShot\(src\)/, "区域页顶上那条点不开");
  assert.equal(dwell.split("fullShot);").length - 1, 3, "fullShot 定义了却没挂进那三页，等于没有");
  // 返回键先退出图，别一下把整页退掉
  assert.match(dwell, /if \(shot\) \{ setShot\(""\); \}/);
});

test("档案腔一个都不许留——那套话换个 app 照样成立，就是没设计", () => {
  // 只看活着的代码——注释里要留着病因，不然下一个人不知道这套话为什么被撤掉
  const live = dwell.split("\n").filter(l => !/^\s*\/\//.test(l)).join("\n");
  ["场所观察档案", "空间索引", "现场视图", "物件观察卡", "外观与来路", "区域档案",
   "现场影像", "重新观察", "补现场图", "尚未补现场图", "删除这份场所档案"].forEach(function (w) {
    assert.equal(live.indexOf(w), -1, "还留着档案腔：" + w);
  });
  assert.match(dwell, /原样搬进房产 app、勘察 app、库存 app 都成立/, "病因没写在代码里，下一个人会再写一遍");
  // 「区域 01 / 02」这种编号也是档案的：他摆东西的地方不是编号的
  assert.ok(!/"区域 " \+ String\(/.test(dwell), "区域还在编号");
  assert.ok(!/String\(j \+ 1\)\.padStart/.test(dwell), "物件还在编号");
  // 换上来的是人话
  assert.match(dwell, /"摆着 " \+ items\.length \+ " 样"/);
  assert.match(dwell, /"点开看全屏"/);
  assert.match(dwell, /"再去看一遍"/);
  assert.match(dwell, /"不留这个地方了"/);
});

test("一块区域长成一条台面，不是两列瓷砖也不是带 › 的设置项", () => {
  const i = dwell.indexOf("const surface = function (z, i, opt) {");
  assert.ok(i > 0, "没有台面这个东西");
  const src = dwell.slice(i, dwell.indexOf("\n    };", i));
  // 台面本身：一条压在东西底下的线，底下一道影子
  // ⚠️台面现在压在图上，所以线是【亮的】、影子在下面。暗线亮影在图上根本看不见
  assert.match(src, /const ledge = h\("div", \{ style: \{ height: 3, background: "rgba\(244,241,233,\.82\)"/);
  assert.match(src, /boxShadow: "0 7px 12px -6px rgba\(0,0,0,\.75\)"/, "台面没有影子，就只是一条分割线");
  // 东西是【摆在上面】的：底边开着，压在那条线上
  assert.match(src, /borderBottom: "none", borderRadius: "6px 6px 0 0"/, "东西的框四边都封着，没有摆在台面上的样子");
  assert.match(src, /alignItems: "flex-end"/, "东西没有对齐到台面那条线上");
  // ⚠️一行放不下要分层，每层各有自己那条台面
  assert.match(src, /for \(var r = 0; r < items\.length; r \+= per\)/, "还在靠 flex-wrap 折行");
  assert.ok(src.indexOf("flex-wrap") < 0, "flex-wrap 折出来的上面那折会悬空，不在任何台面上");
  assert.match(src, /flex: "1 1 0"/, "末层只剩一样时会缺半截台面");
  // ⚠️v60.03 起 opt 只剩 big 一档：onName / onZone 是地点页那一段用的，那一段撤了就跟着删
  assert.ok(src.indexOf("o.onName") < 0 && src.indexOf("o.onZone") < 0, "撤掉的那两个回调还留着");
  // 名字要全都看得见，不许缩成「N 件」再让人点进去猜
  assert.match(src, /rows\.push\(items\.slice\(r, r \+ per\)\)/, "有东西没被摆出来");
  assert.match(src, /row\.map\(function \(x, j\)/);
  assert.ok(src.indexOf("slice(0, 2)") < 0, "又把东西缩成两个名字的预览了");
  assert.ok(src.indexOf("›") < 0 || /他心里有句话没说 ›/.test(src), "又摆回设置项那个箭头了");
  // 点得着（mobile-ui-layout）
  assert.match(src, /minHeight: 44/);
});

// ⚠️v60.03 起地点页【只留图】（她 2026-09-01：「下面那一堆可以不要了，反正别的那些
//   也可以从上面进去，就留图吧」）。图上已经有一整套入口，底下那段台面是同一批入口的
//   第二份，而且把图挤成了「顶上一张插图」。
test("一处地方：就是这张图，底下不再铺第二份入口", () => {
  const i = dwell.indexOf('// ── 一处地方：就是这张图 ────────────────────────────────');
  assert.ok(i > 0, "找不到地点页");
  const src = dwell.slice(i, dwell.indexOf('// ── 某个人的地点列表', i));
  assert.match(src, /flex-1 min-h-0 overflow-y-auto/, "地点页内容多了不会滚");
  assert.match(src, /placeHero\(open, zs\)/);
  // 图底下不许再铺一遍台面
  assert.ok(src.indexOf("surface(") < 0, "图底下又铺了一份台面——同一批入口的第二份");
  assert.ok(src.indexOf("itemCount") < 0, "那句档案式的数量统计又回来了");
  // 三颗操作键还得在（它们没有别的地方可去）
  assert.match(src, /"再去看一遍"/);
  assert.match(src, /"重画这儿的样子" : "画一张这儿的样子"/);
  assert.match(src, /"不留这个地方了"/);
  // 内容不许因为换 UI 丢掉：氛围、整屏、入口都在图上
  const hero = dwell.slice(dwell.indexOf("const placeHero = function"), dwell.indexOf("\n    };", dwell.indexOf("const placeHero = function")));
  assert.match(hero, /p\.ambient \? h\("div"[\s\S]{0,260}\}, p\.ambient\)/, "进门第一感觉没了");
  assert.match(hero, /minHeight: "calc\(100dvh - env\(safe-area-inset-top\) - 58px\)"/, "第一屏不再是整屏");
  assert.match(hero, /\(z\.items \|\| \[\]\)\.length \+ " 样"/, "图上那几行看不出每块有几样");
  // 台面这个形状留着——它在【区域页】还是主角
  assert.match(dwell, /surface\(zone, 0, \{ big: true \}\)/, "区域页的台面被一起删了");
  // 星图那套结构不许回来
  assert.doesNotMatch(src, /pinTop|pointerEvents|onLeft|backdropFilter/, "星图小签的结构又回来了");
});

test("一块区域：同一条台面，只是走到跟前了", () => {
  const src = dwell.slice(dwell.indexOf('if (view === "place" && open && zone)'), dwell.indexOf('// ── 门：推开才进去'));
  assert.match(src, /surface\(zone, 0, \{ big: true \}\)/, "区域页换了个排版——人会以为自己换了个地方");
  assert.match(src, /placePhoto\(open, 116\)/, "看不见这是在哪处地方");
  assert.match(src, /"点一样，看他心里怎么说它。"/);
});

test("一件东西：他心里那句是这一页唯一的主角", () => {
  const src = dwell.slice(dwell.indexOf('if (view === "place" && open && item)'), dwell.indexOf('if (view === "place" && open && zone)'));
  // 纸面上唯一那块深色＝心里那句；看得见的写在纸上
  // 地皮换成了那处地方糊开的图，所以那句话跟着翻面：它是压在图上的一张纸，
  // 仍然是这一页唯一那块【跟地皮材质相反】的东西
  assert.match(src, /item\.thought \? h\("div", \{ style: \{ position: "relative", marginTop: 26, background: FIELD_PAPER, color: FIELD_INK/,
    "那句话跟这一页的地皮成了同一种材质，一眼分不出来了");
  assert.match(src, /boxShadow: "0 16px 34px rgba\(0,0,0,\.42\)"/, "纸没有压在图上的样子");
  assert.match(src, /fontFamily: "'Noto Serif SC',serif", fontSize: 17/, "那句话没有比说明大");
  assert.match(src, /"—— " \+ \(char \? char\.name : "他"\) \+ " 没说出口"/);
  // note 不再包成一张跟它平起平坐的卡片
  assert.ok(src.indexOf("borderRadius: 10, padding") < 0, "说明又做成了跟那句话平起平坐的卡片");
  assert.match(src, /item\.note \?/, "说明丢了");
  // 没有那句话时也要说得清，不是一片空白
  assert.match(src, /"这样东西他没往心里去。"/);
});

test("没出图不是坏了，是还没画；画图、重画、再看一遍都还在", () => {
  const i = dwell.indexOf("const placePhoto = function (p, height) {");
  const photo = dwell.slice(i, dwell.indexOf("\n    };", i));
  assert.match(photo, /const src = srcOf\(p\)/);
  assert.match(photo, /backgroundImage:/, "没图时没有平面图式占位");
  assert.match(photo, /"还没画过这儿"/);
  assert.match(dwell, /open\.img \? "重画这儿的样子" : "画一张这儿的样子"/);
  assert.match(dwell, /busy \? "正在再看一遍…" : "再去看一遍"/);
  // 没图的时候不该摆一个点不开的「点开看全屏」
  assert.match(photo, /src \? h\("div"[\s\S]{0,220}"点开看全屏"\) : null/, "没图时还挂着看全屏的提示");
});

test("出图开关：默认开、关得掉、记得住", () => {
  const { D, store } = load();
  assert.equal(D.loadCfg().withImg, true, "默认该带图——不带图那一屏是兜底，不是常态");
  D.saveCfg({ withImg: false });
  assert.equal(D.loadCfg().withImg, false, "关了没记住");
  D.saveCfg({ withImg: true });
  assert.equal(D.loadCfg().withImg, true, "开不回来");
  assert.deepEqual(Object.keys(JSON.parse(JSON.stringify(store.x_dwellCfg))), ["withImg"], "存了多余的字段");
});

test("四层：门 → 想见谁 → 他的地点 → 那处地方，退也是一层一层退", () => {
  ["door", "who", "places", "place"].forEach(v => assert.ok(dwell.includes('"' + v + '"'), "少了这一层：" + v));
  const i = dwell.indexOf("function back() {");
  const src = dwell.slice(i, dwell.indexOf("\n    }", i));
  assert.match(src, /view === "place"[\s\S]{0,200}setView\("places"\)/, "从那处地方退该回到他的地点列表");
  assert.match(src, /view === "places"[\s\S]{0,80}setView\("who"\)/, "从地点列表退该回到想见谁");
  assert.match(src, /view === "who"[\s\S]{0,80}setView\("door"\)/, "从想见谁退该回到门");
  assert.match(src, /props\.onBack/, "在门口再退一次该退出这个 app");
  // 推开门要有推开的样子，不是直接跳
  assert.match(dwell, /rotateY\(-72deg\)/, "门没有推开的动作");
  assert.match(dwell, /想见谁/, "推开之后那句话没了");
});

test("生成完直接进那处地方；带图开着才接着出图", () => {
  const i = dwell.indexOf("async function gen(hintName, prev) {");
  const src = dwell.slice(i, dwell.indexOf("\n    }", i));
  assert.match(src, /setView\("place"\)/, "生成完没跳进那处地方，还得她自己再点一次");
  assert.match(src, /if \(cfg\.withImg\) await draw\(made\)/, "开关没接上——要么白花一次出图的钱，要么开了也不出图");
  // 刚写出来的是哪一条，得认得出来：重写认 id，新写认「多出来的那条」
  assert.match(src, /p\.id === prev\.id/);
  assert.match(src, /!before\.has\(p\.id\)/);
});

// 她 2026-08-30：「在一起 X 天放到名字右边，X 放大标粉；轮换点挪右下」
test("情侣卡：名字与粉色大号天数同排，轮换点在右下", () => {
  const i = comp.indexOf("function UsWidget(");
  const body = comp.slice(i, comp.indexOf("\nfunction ", i + 10));
  assert.match(body, /className: "flex items-baseline min-w-0"/, "名字和天数没有放进同一条弹性基线");
  assert.match(body, /fontSize: 21, fontWeight: 700, color: "#e78fa1"/, "X 没有单独放大标粉");
  assert.match(body, /fontSize: 18/, "名字没有跟着整体放大");
  assert.match(body, /fontSize: 12\.5, color: t\.sub/, "甜蜜值没有跟着整体放大");
  const nameLine = body.split("\n").find(l => l.includes("p.remark || p.name")) || "";
  assert.match(nameLine, /flex: "1 1 auto"/, "名字没有弹性宽度，长名字仍会把天数挤坏");
  assert.match(nameLine, /whiteSpace: "nowrap"/, "名字没锁单行");
  assert.match(body, /position: "absolute", right: 14, bottom: 9/, "轮换点没有从右中移到右下");
  assert.match(body, /position: "absolute", top: 10, right: 12/, "右上未读红点被误挪走了");
});

// 她 2026-08-30：「这俩细节框再修修，默认不要这种半窗」→ 施工规则/no-half-sheet.md
test("区域和物件都是整页，不是从底下掀起来的半窗", () => {
  assert.equal(dwell.indexOf("h(Sheet"), -1, "去处里还留着半窗：内容被压到下半屏，说明一句都放不下");
  ["view === \"place\" && open && zone", "view === \"place\" && open && item"].forEach(k =>
    assert.ok(dwell.includes(k), "少了这一整页：" + k));
  // 整页得照移动端那套骨架：顶栏不缩、正文自己滚。⚠️两页各自单独看——
  // 合成一段切片的话，改坏其中一页、另一页还留着同一串字，测试就抓不到了
  const pages = {
    物件页: dwell.slice(dwell.indexOf('if (view === "place" && open && item)'), dwell.indexOf('if (view === "place" && open && zone)')),
    区域页: dwell.slice(dwell.indexOf('if (view === "place" && open && zone)'), dwell.indexOf('// ── 门：推开才进去'))
  };
  Object.keys(pages).forEach(function (k) {
    assert.match(pages[k], /className: "h-full flex flex-col relative"/, k + "：整页外壳不对");
    assert.match(pages[k], /flex-1 min-h-0 overflow-y-auto/, k + "：正文不会滚，内容长一点就看不全");
    assert.match(pages[k], /overBar\(/, k + "：没用整页那个顶栏");
    assert.match(pages[k], /backdrop\(open\)/, k + "：没把上一层那张图糊开压暗当底衬");
  });
  // 顶栏是 overBar 出的，在这两页之前就定义好了，得单独看
  const bar = dwell.slice(dwell.indexOf("const overBar = function"), dwell.indexOf("\n    };", dwell.indexOf("const overBar = function")));
  assert.match(bar, /shrink-0 flex items-center px-4/, "顶栏会被正文挤扁");
  assert.match(bar, /safeTop\(10\)/, "顶栏没让开刘海");
  // 顶栏也压在图上：自己刷一层不透明底色的话，那一条就把底衬盖死了
  assert.match(bar, /background: "linear-gradient\(180deg,rgba\(8,11,13,\.86\),rgba\(8,11,13,\.28\)\)"/,
    "顶栏自己刷了一层不透明底，底衬在那一条上被盖死");
});

test("规矩写下来了，而且写的是【默认整页】", () => {
  const rule = ruleText("no-half-sheet");
  assert.match(rule, /默认用整页/, "没把默认说清楚");
  assert.match(rule, /h\(Sheet/, "没指出代码里对应的是哪个东西，下一个人对不上号");
  assert.match(rule, /需要同时看见它下面那一层吗/, "没给判据，只有结论的话照样会有人再写一个半窗");
});

// ===== v59.88 =====
// 她 2026-09-01：「这些页面没有图片背景了嘤，就我还是想要能直接从图片里点击进去看，
// 但是不要照片上挂悬浮胶囊＋连线＋幽灵英文」。
test("图是每一层的地皮：内页也要把上一层那张图糊开压暗当底衬", () => {
  const rule = ruleText("no-half-sheet");
  assert.match(rule, /上一层如果有图，就把那张图糊开压暗当底衬/, "这条规矩本来就写着，别把它也删了");
  const i = dwell.indexOf("const backdrop = function (p) {");
  assert.ok(i > 0, "内页又变回一张跟上一层无关的白纸了——进了屋反而看不见屋");
  const bd = dwell.slice(i, dwell.indexOf("\n    };", i));
  // ⚠️看的是【最外面那一层】铺没铺满：里面那层遮罩本来就是 absolute inset 0，
  //   笼统 match 一下会被它顶住，外壳改成 relative 也照样绿
  assert.match(bd, /const backdrop = function \(p\) \{\s*const src = srcOf\(p\);\s*return h\("div", \{ "aria-hidden": "true", style: \{ position: "absolute", inset: 0, overflow: "hidden"/,
    "底衬没铺满，或者中间被人塞了一句提前 return");
  assert.match(bd, /filter: "blur\(22px\) brightness\(\.72\) saturate\(\.95\)"/, "没糊开压暗，图会抢正文");
  assert.match(bd, /backgroundImage: "linear-gradient\(rgba\(255,255,255,\.05\)/, "没图的时候底衬是一片死黑");
  // 三层都要有：那处地方、那块区域、那件东西
  assert.equal(dwell.split("backdrop(open)").length - 1, 3, "三层里有一层没铺底衬");
  // 内页不许再自己刷一层不透明的纸，否则底衬白铺了
  const inner = dwell.slice(dwell.indexOf('if (view === "place" && open && item)'), dwell.indexOf('// ── 门：推开才进去'));
  assert.ok(!/background: FIELD_PAPER, color: FIELD_INK \}/.test(inner.replace(/item\.thought[\s\S]*?没说出口/, "")), "内页整页又刷成白纸了");
});

test("从图里直接点进去：区域名压在照片下缘，不挂胶囊、不连线、不摆幽灵英文", () => {
  const i = dwell.indexOf("const placeHero = function (p, zs) {");
  const hero = dwell.slice(i, dwell.indexOf("\n    };", i));
  // 入口就在图上
  assert.match(hero, /zs\.map\(function \(z, i\) \{[\s\S]{0,200}onClick: function \(\) \{ setZoneIdx\(i\); \}/, "图上点不进任何一块");
  assert.match(hero, /borderTop: "1px solid " \+ OVER_LINE/, "那几行不是照片自己那条说明的样子");
  assert.match(hero, /minHeight: 42/, "图上那几行点不着");
  // 铺满的那一层是「看全屏」，压在上面要能点的那一叠必须在它外面
  assert.match(hero, /pointerEvents: "none"/);
  assert.match(hero, /pointerEvents: "auto"/, "区域那几行被底下那个铺满的按钮吃掉了点击");
  // ⚠️不许回到照片上挂胶囊＋连线＋幽灵英文那一套——它还得替每块编个假坐标
  // （只看区域那几行——右上角「点开看全屏」那颗药丸不是区域入口，不算）
  const rows = hero.slice(hero.indexOf("zs.map(function (z, i)"));
  assert.ok(!/borderRadius: 999/.test(rows), "又在照片上挂胶囊了");
  assert.ok(!/pinTop|onLeft|width: 26, height: 1|backdropFilter/.test(rows), "又在照片上连线了");
  assert.ok(!/toUpperCase\(\)|letterSpacing/.test(rows), "又在照片上摆幽灵英文了");
  // 一块区域都没有时也得说句话，不是留一片空
  assert.match(hero, /"这儿还什么都没摆。"/);
});
