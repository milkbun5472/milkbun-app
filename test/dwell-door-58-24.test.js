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

// 她 2026-08-30：「图占比太小」→ 全屏；「下面描述和图上重复了两处都有太繁琐」→ 图上挂小签就够了
test("细线只铺在中间那一段：上不压顶栏、下不压那句氛围", () => {
  const { D } = load();
  for (const n of [2, 3, 4, 5, 6]) {
    const tops = Array.from({ length: n }, (_, i) => D.pinTop(i, n));
    assert.ok(Math.min(...tops) >= 15, n + " 块时最上面那根在 " + Math.min(...tops) + "%，会压到顶栏");
    assert.ok(Math.max(...tops) <= 74, n + " 块时最下面那根在 " + Math.max(...tops) + "%，会压到底下那句氛围");
    for (let i = 1; i < n; i++) assert.ok(tops[i] > tops[i - 1], "线的顺序乱了：" + tops.join(" "));
    // 挨太近会糊成一坨
    if (n > 1) assert.ok(tops[1] - tops[0] >= 9, n + " 块时线挨得太近：" + tops.join(" "));
  }
  assert.ok(D.pinTop(0, 1) > 30 && D.pinTop(0, 1) < 60, "只有一块的时候该在中间");
});

test("全屏那一页不再把区域名列第二遍", () => {
  const i = dwell.indexOf('if (view === "place" && open)');
  assert.ok(i > 0, "找不到全屏那一页");
  const src = dwell.slice(i, dwell.indexOf('// ── 某个人的地点列表', i));
  // 区域名只该出现在小签上；底下那一块只留氛围
  const zoneNameUses = src.split("z.name").length - 1;
  assert.equal(zoneNameUses, 1, "区域名在全屏页出现了 " + zoneNameUses + " 处，图上挂了还在下面再列一遍就是重复");
  assert.match(src, /open\.ambient/, "那一句氛围没了");
});

test("没出图不是坏了：暗底加英文名，细线照样能点", () => {
  const i = dwell.indexOf('if (view === "place" && open)');
  const src = dwell.slice(i, dwell.indexOf('// ── 某个人的地点列表', i));
  assert.match(src, /open\.img\s*\n?\s*\?/, "没有分「有图/没图」两种画法");
  assert.match(src, /\(open\.en \|\| "PLACE"\)\.toUpperCase\(\)/, "没图的时候没有兜底的英文名，会是一整块空黑屏");
  assert.match(src, /open\.img \? "重画一张" : "补一张图"/, "没图的时候没有补图的入口");
  // 小签得点得动：外面那层是 pointerEvents:none，小签自己必须放开
  assert.match(src, /pointerEvents: "none"/, "覆盖层没设 none，会把整张图挡住");
  assert.match(src, /pointerEvents: "auto"/, "小签点不动");
  assert.match(src, /onClick: function \(\) \{ setZoneIdx\(i\); \}/, "点了小签没翻到那一块");
  assert.match(src, /\(open\.zones \|\| \[\]\)\.slice\(0, 6\)/, "小签没封顶，区域多了会糊成一片");
  // 小签是画在图层外面的，跟有没有图无关
  const pinAt = src.indexOf("pinTop(i, zs.length)");
  const imgBranch = src.indexOf("open.img\n          ?");
  assert.ok(pinAt > 0 && (imgBranch < 0 || pinAt > imgBranch), "小签被塞进了「有图」那一支，没图就点不到了");
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
    assert.match(pages[k], /className: "h-full flex flex-col relative"/, k + "：整页外壳不对");
    assert.match(pages[k], /flex-1 min-h-0 overflow-y-auto/, k + "：正文不会滚，内容长一点就看不全");
    assert.match(pages[k], /darkBar\(/, k + "：没用整页那个顶栏");
    assert.match(pages[k], /backdrop\(open\)/, k + "：没有底衬");
  });
  const src = pages.物件页;
  // 顶栏是 darkBar 出的，在这两页之前就定义好了，得单独看
  const bar = dwell.slice(dwell.indexOf("const darkBar = function"), dwell.indexOf("\n    };", dwell.indexOf("const darkBar = function")));
  assert.match(bar, /shrink-0 flex items-center px-4/, "顶栏会被正文挤扁");
  assert.match(bar, /safeTop\(10\)/, "顶栏没让开刘海");

});

test("底衬用上一层那张图糊开——但不能用 width 撑，会被 max-width 按回去", () => {
  const i = dwell.indexOf("const backdrop = function (p) {");
  assert.ok(i > 0, "找不到底衬");
  const src = dwell.slice(i, dwell.indexOf("\n    };", i));
  assert.match(src, /blur\(/, "底衬没糊开，会跟正文抢眼睛");
  assert.match(src, /transform: "scale\(1\.1[0-9]?\)"/, "没往外撑：糊开之后边缘会透出底色");
  assert.ok(!/width: "(?!100%)1[0-9][0-9]%"/.test(src), "又用 width 往外撑了——全局 img{max-width:100%} 会把它按回 100%，右边空一条");
  assert.match(src, /radial-gradient/, "上一层没图的时候没有兜底底衬");
});

// 她 2026-08-30：「有图的地方还是没有糊开压暗，还只是兜底的暗底」——
// 图一直都在，是压得太狠：屋里的照片本来就暗，再盖一层 .70→.93 的黑就跟没图一样。
// 量出来底衬平均色 (20,20,22)、冷暖差只剩 1.5；调完是 (47,39,30)、冷暖差 17.6。
test("底衬不许把图盖没：压暗有上限，暗照片要提亮", () => {
  const i = dwell.indexOf("const backdrop = function (p) {");
  const src = dwell.slice(i, dwell.indexOf("\n    };", i));
  const scrim = (src.match(/rgba\(\d+,\s*\d+,\s*\d+,\s*(\.\d+|0\.\d+|1)\)/g) || [])
    .map(x => parseFloat(x.slice(x.lastIndexOf(",") + 1)));
  assert.ok(scrim.length, "找不到压暗那一层");
  const worst = Math.max.apply(null, scrim);
  assert.ok(worst <= 0.78, "压到 " + worst + " 了——照片会被盖成一片死黑，跟没图一个样（白字对比度早就够了，不用压这么狠）");
  const filt = src.match(/filter: "([^"]+)"/);
  assert.ok(filt, "底衬图没有 filter");
  assert.match(filt[1], /blur\(/, "没糊开，会跟正文抢眼睛");
  assert.match(filt[1], /brightness\(1\.[2-9]/, "没提亮——屋里的照片本来就暗，糊开之后更暗");
  assert.match(filt[1], /saturate\(1\./, "没加饱和，糊完只剩一团灰");
});

test("规矩写下来了，而且写的是【默认整页】", () => {
  const rule = fs.readFileSync(path.join(__dirname, "..", ".claude", "rules", "no-half-sheet.md"), "utf8");
  assert.match(rule, /默认用整页/, "没把默认说清楚");
  assert.match(rule, /h\(Sheet/, "没指出代码里对应的是哪个东西，下一个人对不上号");
  assert.match(rule, /需要同时看见它下面那一层吗/, "没给判据，只有结论的话照样会有人再写一个半窗");
});
