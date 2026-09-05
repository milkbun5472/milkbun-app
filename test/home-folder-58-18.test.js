const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const comp = fs.readFileSync(path.join(__dirname, "..", "js", "components.js"), "utf8");

// 把主屏布局那几个真函数抠出来跑（不碰 React、不碰 DOM）
function makeHome(layout, folders) {
  const grab = (a, b) => { const i = comp.indexOf(a); const j = comp.indexOf(b, i); assert.ok(i > 0 && j > i, "抠不出：" + a); return comp.slice(i, j); };
  const src = [
    // v58.52：占几格这件事被搬去了顶层的 homeItemSpan（Codex 的组件尺寸自定义），
    // spanOf 现在是转手调它。只抠 SP_RE 那一段的话，sandbox 里 homeItemSpan 是 undefined，
    // 六条测试一起 ReferenceError——所以连着它和它的两块料一起抠。
    grab("const HOME_SIZE_PRESETS = [", "function homeWidgetPresetStyle("),
    grab("  const DEFAULT_LAYOUT = [", "  const SP_RE = /^sp_/;"),
    // SP_RE 到 buildLayout 之间那一整段（SP_RE / spanOf / wOf / rowsOf）一起抠，
    // 免得以后这里多一个辅助函数、测试却只抠到其中一半
    grab("  const SP_RE = /^sp_/;", "  // 存档 + 注册表 → 完整布局"),
    grab("  function buildLayout(saved) {", "  function persistFolders(nf)"),
    grab("  function findSlot(L, key) {", "  // 放下：from 和 to 交换位置"),
    grab("  function removeFromFolder(fid, key) {", "  function renameFolder(fid, name)")
  ].join("\n");
  // REG 每项都挂着图标组件，跑逻辑用不着
  const regSrc = grab("  const REG = {", "\n  };") + "\n  };";
  const REG = new Function(regSrc.replace(/G:[^,}]+/g, "G: null") + "\nreturn REG;")();
  const st = { layout: JSON.parse(JSON.stringify(layout)), folders: JSON.parse(JSON.stringify(folders)), jumpedTo: undefined };
  const foldersRef = { current: st.folders };
  const api = new Function("REG", "loadJSON", "saveJSON", "foldersRef", "page", "setLayout", "persistFolders", "goPage", "widgetSizes",
    src + "\nreturn { buildLayout: buildLayout, removeFromFolder: removeFromFolder, findSlot: findSlot };")(
    REG,
    (k, d) => k === "x_homeLayout" ? st.layout : (k === "x_homeFolders" ? st.folders : d),
    (k, v) => { if (k === "x_homeLayout") st.layout = v; if (k === "x_homeFolders") st.folders = v; },
    foldersRef, 0,
    fn => { const r = fn(st.layout); if (r) st.layout = r; },
    nf => { foldersRef.current = nf; st.folders = nf; },
    np => { st.jumpedTo = np; },
    {});   // 没有自定义尺寸 → 每项都按默认占格
  return { api, st, foldersRef };
}
// 24 格塞满一页。⚠️里面只许放【当前 REG 里真有】的 key——放了已经退场的（比如 v58.22 撤掉的
// 日记/备忘录）会被 buildLayout 滤掉，这一页就不满了，「满页」那几条测试会静悄悄地变成空转。
// v63.58：页面能上下滑之后，一页的容量闸从 6 行放宽到 8 行（32 格）——
// 这份「满页」样本要跟着补到 32 格，不然下面几条满页测试会静悄悄变成空转。
// 1×1 的 app 一共只有 29 个（其中 shop/dwell 在文件夹里），所以补一个 2×2 的组件凑够。
const FULL = ["f_1", "w_muyu", "cast", "ties", "phone", "cwallet", "lore", "memlib", "assistant", "anon", "study",
  "fanfic", "weekly", "carry", "theater", "impression", "read", "debate", "dream", "tarot",
  "pomodoro", "games", "trpg", "dreamjournal", "yanqiu",
  "rescue", "vpscodex", "loungeapp", "stylelab"];
// goPage 是放在 setTimeout(…,0) 里的：在别的 setState updater 里同步调 setState
// 是 React 的忌讳（updater 必须是纯的），所以推到下一拍。测试跟着等一拍。
const tick = () => new Promise(r => setTimeout(r, 5));
// FULL 真的塞满了没？——里面混进一个已经退场的 key，这一页就不满了，
// 下面那几条「满页」测试会静悄悄变成空转，比失败还难发现
test("测试用的满页样本必须真的是满的", () => {
  const { api } = makeHome({ 0: FULL }, { f_1: { name: "杂物", keys: ["shop", "dwell"] } });
  const kept = api.buildLayout({ 0: FULL })[0].filter(k => !/^sp_/.test(k));
  assert.equal(kept.length, FULL.length, "FULL 里有 " + (FULL.length - kept.length) + " 个 key 在 REG 里已经没了：" +
    FULL.filter(k => !kept.includes(k)).join(" "));
});
const pageOf = (L, key) => { for (let i = 0; i < L.length; i++) if ((L[i] || []).includes(key)) return i; return -1; };
const reach = (L, fr) => {
  const s = new Set();
  L.forEach(a => (a || []).forEach(k => { if (!/^sp_/.test(k)) s.add(k); }));
  Object.keys(fr.current).forEach(f => { if (s.has(f)) (fr.current[f].keys || []).forEach(k => s.add(k)); });
  return s;
};

// 她 2026-08-30：「我把购物从第一页的文件夹整理出来，然后找不到了」
test("从满页的文件夹里拿东西出来——东西不许丢", () => {
  const { api, st, foldersRef } = makeHome({ 0: FULL, 1: [], 2: [], 3: [] }, { f_1: { name: "杂物", keys: ["shop", "dwell"] } });
  api.removeFromFolder("f_1", "shop");
  const L = api.buildLayout(st.layout);
  assert.ok(reach(L, foldersRef).has("shop"), "购物真的不见了");
  assert.equal(foldersRef.current.f_1.keys.indexOf("shop"), -1, "该从文件夹里拿掉");
  // 文件夹掏空之后，那一格就变成这个 app 本身
  const h2 = makeHome({ 0: FULL, 1: [], 2: [], 3: [] }, { f_1: { name: "杂物", keys: ["shop"] } });
  h2.api.removeFromFolder("f_1", "shop");
  const L2 = h2.api.buildLayout(h2.st.layout);
  assert.equal(pageOf(L2, "shop"), 0, "文件夹只剩一个时，拿出来该占住原来那一格");
  assert.equal(h2.foldersRef.current.f_1, undefined, "空文件夹该删掉");
});

test("⚠️这一页放不下就会被挤到下一页——得跟着翻过去，不然跟丢了一样", async () => {
  const { api, st } = makeHome({ 0: FULL, 1: [], 2: [], 3: [] }, { f_1: { name: "杂物", keys: ["shop", "dwell"] } });
  api.removeFromFolder("f_1", "shop");
  await tick();
  const L = api.buildLayout(st.layout);
  const p = pageOf(L, "shop");
  assert.notEqual(p, 0, "这一页本来就满了，它只能落到别页");
  assert.equal(st.jumpedTo, p, "落在页" + p + " 却没翻过去——她还站在原来那一页找");
  // 落点要按【规整之后】的布局算：光看 push 进去那一刻还在页 0，是错的
  assert.match(comp, /var pos2 = findSlot\(buildLayout\(saved\), key\);/);
  assert.match(comp, /if \(pos2 && pos2\.p !== page\) setTimeout\(function \(\) \{ goPage\(pos2\.p\); \}, 0\);/);
});

test("同一页放得下的时候别乱翻页", async () => {
  const { api, st } = makeHome({ 0: ["f_2", "cast", "ties"], 1: [], 2: [], 3: [] }, { f_2: { name: "杂物", keys: ["shop", "dwell"] } });
  api.removeFromFolder("f_2", "shop");
  await tick();
  assert.equal(pageOf(api.buildLayout(st.layout), "shop"), 0);
  assert.equal(st.jumpedTo, undefined, "就在眼前还翻页，会把她搞晕");
});

test("每一页都满的时候也不许丢", async () => {
  const { api, st, foldersRef } = makeHome({
    0: FULL,
    1: ["w_card", "w_cal", "w_music", "w_map", "w_us", "w_memo"],
    2: ["loungeapp", "rescue", "vpscodex", "assistant", "stylelab", "w_weather", "w_ledger", "w_muyu", "w_wheel"],
    3: []
  }, { f_1: { name: "杂物", keys: ["shop", "dwell"] } });
  api.removeFromFolder("f_1", "shop");
  await tick();
  const L = api.buildLayout(st.layout);
  assert.ok(reach(L, foldersRef).has("shop"), "挤来挤去把它挤没了");
  assert.equal(st.jumpedTo, pageOf(L, "shop"));
});

test("REG 里每个 app 在整理之后都还找得到（安全网还在）", () => {
  const { api, st, foldersRef } = makeHome({ 0: FULL, 1: [], 2: [], 3: [] }, { f_1: { name: "杂物", keys: ["shop", "dwell"] } });
  api.removeFromFolder("f_1", "shop");
  api.removeFromFolder("f_1", "dwell");
  const L = api.buildLayout(st.layout);
  const R = reach(L, foldersRef);
  const regSrc = comp.slice(comp.indexOf("  const REG = {"), comp.indexOf("\n  };", comp.indexOf("  const REG = {")) + 4);
  const REG = new Function(regSrc.replace(/G:[^,}]+/g, "G: null") + "\nreturn REG;")();
  const missing = Object.keys(REG).filter(k => REG[k].kind === "app" && !R.has(k));
  assert.deepEqual(missing, [], "这些 app 从主屏上消失了：" + missing.join("、"));
});

test("时光胶囊搬进情侣空间后，旧主屏布局里的入口会自动退场", () => {
  const { api } = makeHome({ 0: ["capsule", "cast"] }, {});
  const L = api.buildLayout({ 0: ["capsule", "cast"] });
  assert.equal(pageOf(L, "capsule"), -1, "旧布局里的胶囊图标不该继续留在主屏");
  assert.notEqual(pageOf(L, "cast"), -1, "清掉胶囊时不能误伤旁边的正常 app");
});

test("两道防线各自还在——它们互相兜底，行为测试分不出来", () => {
  // ⚠️「满页就 push 到末尾」和 buildLayout 里那张安全网，任一条单独都能保住东西，
  // 所以把其中一条改坏，上面几条行为断言【照样绿】（实测过）。
  // 这种时候只能各钉一次，并把「为什么不是行为测试」写下来。
  // ① 这一页没有空位时，仍然把它接在末尾（后面由容量规整挤到下一页）
  assert.match(comp, /if \(si >= 0\) arr\[si\] = key; else arr\.push\(key\);/,
    "满页时不接到末尾＝这一刻它谁也不属于，只能指望安全网");
  // ② 安全网：REG 里任何 app，既不在任何页、也不在【真的摆在页上的】文件夹里，就补回默认页
  const i = comp.indexOf("⭐安全网");
  assert.ok(i > 0, "安全网那段注释都没了");
  const net = comp.slice(i, i + 1600);
  // 验行为不验长相（8/29 军规）：守卫必须救 app 且看 reach；扩容救 widget 也合法
  {
    const guard = net.match(/if \(REG\[key\] && [^\n]*!reach\[key\]\) \{/);
    assert.ok(guard, "安全网守卫必须存在且以 !reach[key] 判失踪");
    assert.ok(/kind === "app"/.test(guard[0]), "安全网至少要救 app");
  }
  assert.match(net, /var dp = defPage\[key\] != null \? defPage\[key\] : \(out\.length - 1\);/,
    "不知道默认页的要补到末页，不能不补");
  // ③ 容量规整：超出的整体溢到下一页，不是丢掉
  assert.match(comp, /if \(cspill\.length\) out\[ci \+ 1\] = cspill\.concat\(out\[ci \+ 1\] \|\| \[\]\);/);
});
