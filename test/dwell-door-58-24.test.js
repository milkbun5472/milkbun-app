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

// 她 2026-08-30 第二次报：「情侣空间名字又看不见了，能不能在一起x天放右上角」
test("情侣卡：天数挪到右上角，名字独占一整行", () => {
  const i = comp.indexOf("function UsWidget(");
  const body = comp.slice(i, comp.indexOf("\nfunction ", i + 10));
  const daysLine = body.split("\n").find(l => l.includes('"在一起第 " + days')) || "";
  assert.match(daysLine, /position: "absolute"/, "天数还跟名字挤在一行——名字只剩一两个字的宽");
  assert.match(daysLine, /top: 11/, "没贴到上面去");
  assert.match(daysLine, /right: dot \? 26 : 14/, "右上角那个红点会跟天数叠在一起");
  const nameLine = body.split("\n").find(l => l.includes("p.remark || p.name")) || "";
  assert.ok(!/在一起第/.test(nameLine), "名字那一行里还留着天数");
  assert.match(nameLine, /whiteSpace: "nowrap"/, "名字没锁单行");
});
