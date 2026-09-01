const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
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

// 她 2026-09-01：暗底节点、连线、幽灵英文和抽屉清单与别的产品太像；
// 但整屏氛围要留，出图以后应该先安静地看完现场和介绍，再向下翻档案。
test("地点总览先给整屏现场与介绍，再向下翻场所档案", () => {
  const i = dwell.indexOf('// ── 一处地方：整屏现场 → 场所观察档案');
  assert.ok(i > 0, "找不到新的场所档案页");
  const src = dwell.slice(i, dwell.indexOf('// ── 某个人的地点列表', i));
  assert.match(src, /immersiveBar\("去处"/);
  assert.match(src, /flex-1 min-h-0 overflow-y-auto/, "地点页内容多了不会滚");
  assert.match(src, /immersivePlaceHero\(open, zs, itemCount\)/);
  assert.match(src, /"场所观察档案"/);
  assert.match(src, /"空间索引"/);
  assert.match(src, /className: "grid grid-cols-2"/, "区域没有收成明确的卡片索引");
  assert.match(src, /onClick: function \(\) \{ setZoneIdx\(i\); \}/, "区域卡点不进去");
  assert.doesNotMatch(src, /pinTop|pointerEvents|onLeft|backdropFilter|borderRadius: 999/, "星图小签的结构还残留在总览页");
});

test("地点档案保留氛围、归属和真实数量，不为新 UI 丢内容", () => {
  const i = dwell.indexOf('// ── 一处地方：整屏现场 → 场所观察档案');
  const src = dwell.slice(i, dwell.indexOf('// ── 某个人的地点列表', i));
  const hero = dwell.slice(dwell.indexOf("const immersivePlaceHero = function"), dwell.indexOf("\n    };", dwell.indexOf("const immersivePlaceHero = function")));
  assert.match(hero, /p\.ambient/, "进门第一感觉没了");
  assert.match(hero, /char \? char\.name : "未归属"/);
  assert.match(hero, /zs\.length \+ " 块区域"/);
  assert.match(hero, /itemCount \+ " 件物品"/);
  assert.match(src, /\(z\.items \|\| \[\]\)\.slice\(0, 2\)/, "区域卡没有用真实物件做预览");
});

test("生成图占满第一可视屏，介绍叠在现场上而不是缩成小卡片", () => {
  const i = dwell.indexOf("const immersivePlaceHero = function");
  const hero = dwell.slice(i, dwell.indexOf("\n    };", i));
  assert.match(hero, /minHeight: "calc\(100dvh - env\(safe-area-inset-top\) - 58px\)"/);
  assert.match(hero, /position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover"/);
  assert.match(hero, /position: "absolute", left: 21, right: 21, bottom:/, "介绍没有叠在图的下部");
  assert.match(hero, /"上翻看索引 ↑"/);
  assert.doesNotMatch(hero, /pinTop|onLeft|borderRadius: 999.*p\.name|\.toUpperCase\(\)/, "整屏现场又做回节点星图了");
});

test("没出图时用平面网格占位，补图、重画和重新观察仍都在", () => {
  const i = dwell.indexOf("const placePhoto = function (p, height) {");
  const photo = dwell.slice(i, dwell.indexOf("\n    };", i));
  assert.match(photo, /p && p\.img/);
  assert.match(photo, /backgroundImage:/, "没图时没有平面图式占位");
  assert.match(photo, /"尚未补现场图"/);
  assert.match(dwell, /open\.img \? "重画现场图" : "补现场图"/);
  assert.match(dwell, /"重新观察"/);
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

test("四层：门 → 想见谁 → 他的地点 → 全屏，退也是一层一层退", () => {
  ["door", "who", "places", "place"].forEach(v => assert.ok(dwell.includes('"' + v + '"'), "少了这一层：" + v));
  const i = dwell.indexOf("function back() {");
  const src = dwell.slice(i, dwell.indexOf("\n    }", i));
  assert.match(src, /view === "place"[\s\S]{0,140}setView\("places"\)/, "从全屏退该回到他的地点列表");
  assert.match(src, /view === "places"[\s\S]{0,80}setView\("who"\)/, "从地点列表退该回到想见谁");
  assert.match(src, /view === "who"[\s\S]{0,80}setView\("door"\)/, "从想见谁退该回到门");
  assert.match(src, /props\.onBack/, "在门口再退一次该退出这个 app");
  // 推开门要有推开的样子，不是直接跳
  assert.match(dwell, /rotateY\(-72deg\)/, "门没有推开的动作");
  assert.match(dwell, /想见谁/, "推开之后那句话没了");
});

test("生成完直接进全屏；带图开着才接着出图", () => {
  const i = dwell.indexOf("async function gen(hintName, prev) {");
  const src = dwell.slice(i, dwell.indexOf("\n    }", i));
  assert.match(src, /setView\("place"\)/, "生成完没跳进全屏，还得她自己再点一次");
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

// 她 2026-08-30：「这俩细节框再修修，默认不要这种半窗」→ .claude/rules/no-half-sheet.md
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
    assert.match(pages[k], /className: "h-full flex flex-col"/, k + "：整页外壳不对");
    assert.match(pages[k], /flex-1 min-h-0 overflow-y-auto/, k + "：正文不会滚，内容长一点就看不全");
    assert.match(pages[k], /fieldBar\(/, k + "：没用整页那个顶栏");
    assert.match(pages[k], /FIELD_PAPER/, k + "：没有场所档案纸面");
  });
  // 顶栏是 fieldBar 出的，在这两页之前就定义好了，得单独看
  const bar = dwell.slice(dwell.indexOf("const fieldBar = function"), dwell.indexOf("\n    };", dwell.indexOf("const fieldBar = function")));
  assert.match(bar, /shrink-0 flex items-center px-4/, "顶栏会被正文挤扁");
  assert.match(bar, /safeTop\(10\)/, "顶栏没让开刘海");
});

test("区域和物件分别用区域档案与观察卡，不是另一份黑底清单", () => {
  const zone = dwell.slice(dwell.indexOf('if (view === "place" && open && zone)'), dwell.indexOf('// ── 门：推开才进去'));
  const item = dwell.slice(dwell.indexOf('if (view === "place" && open && item)'), dwell.indexOf('if (view === "place" && open && zone)'));
  assert.match(zone, /"区域档案 · "/);
  assert.match(zone, /gridTemplateColumns: "42px minmax\(0,1fr\) 16px"/);
  assert.match(item, /"物件观察卡"/);
  assert.match(item, /"外观与来路"/);
  assert.match(item, /" 没说出口的那句"/);
  assert.doesNotMatch(zone + item, /#14161a|ONE THING|\.toUpperCase\(\)|backdrop\(/, "旧黑底展签样式还在区域/物件页");
});

test("规矩写下来了，而且写的是【默认整页】", () => {
  const rule = fs.readFileSync(path.join(__dirname, "..", ".claude", "rules", "no-half-sheet.md"), "utf8");
  assert.match(rule, /默认用整页/, "没把默认说清楚");
  assert.match(rule, /h\(Sheet/, "没指出代码里对应的是哪个东西，下一个人对不上号");
  assert.match(rule, /需要同时看见它下面那一层吗/, "没给判据，只有结论的话照样会有人再写一个半窗");
});
