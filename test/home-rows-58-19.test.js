const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const comp = fs.readFileSync(path.join(__dirname, "..", "js", "components.js"), "utf8");

// 把主屏布局那几个真函数抠出来跑
function makeHome(layout, folders) {
  const grab = (a, b) => { const i = comp.indexOf(a); const j = comp.indexOf(b, i); assert.ok(i > 0 && j > i, "抠不出：" + a); return comp.slice(i, j); };
  const src = [
    "const widgetSizes = {};",
    grab("const HOME_SIZE_PRESETS = [", "function homeWidgetPresetStyle"),
    grab("  const DEFAULT_LAYOUT = [", "  const SP_RE = /^sp_/;"),
    grab("  const SP_RE = /^sp_/;", "  // 存档 + 注册表 → 完整布局"),
    grab("  function buildLayout(saved) {", "  function persistFolders(nf)"),
    grab("  function findSlot(L, key) {", "  // 放下：from 和 to 交换位置"),
    grab("  function removeFromFolder(fid, key) {", "  function renameFolder(fid, name)")
  ].join("\n");
  const regSrc = grab("  const REG = {", "\n  };") + "\n  };";
  const REG = new Function(regSrc.replace(/G:[^,}]+/g, "G: null") + "\nreturn REG;")();
  const st = { layout: JSON.parse(JSON.stringify(layout)), folders: JSON.parse(JSON.stringify(folders)), jumpedTo: undefined };
  const foldersRef = { current: st.folders };
  const api = new Function("REG", "loadJSON", "saveJSON", "foldersRef", "page", "setLayout", "persistFolders", "goPage",
    src + "\nreturn { buildLayout: buildLayout, removeFromFolder: removeFromFolder, findSlot: findSlot, REG: REG };")(
    REG,
    (k, d) => k === "x_homeLayout" ? st.layout : (k === "x_homeFolders" ? st.folders : d),
    (k, v) => { if (k === "x_homeLayout") st.layout = v; if (k === "x_homeFolders") st.folders = v; },
    foldersRef, 0,
    fn => { const r = fn(st.layout); if (r) st.layout = r; },
    nf => { foldersRef.current = nf; st.folders = nf; },
    np => { st.jumpedTo = np; });
  return { api, st, foldersRef, REG };
}

// ⭐测试自己独立写一份 grid-auto-flow:dense 排版器，不复用 app 里的 rowsOf——
// 不然 rowsOf 算错的时候两边一起错，测试等于没测。
// 列数、每项的跨度都照 renderItem 里 gridColumn/gridRow 那一行的规则来。
const COLS = 4;
function spanOfIndependently(REG, key) {
  if (/^sp_/.test(key)) return [1, 1];
  if (key.slice(0, 2) === "f_") return [1, 1];
  const it = REG[key];
  if (!it) return null;
  if (it.kind !== "widget") return [1, 1];
  if (it.which === "cal") return [3, 3];
  if (it.which === "map" || it.which === "muyu" || it.which === "wheel") return [2, 2];
  if (it.which === "weather" || it.which === "ledger") return [2, 1];
  return [COLS, 1];
}
function denseRows(REG, keys) {
  const grid = [];
  let rows = 0;
  const busy = (r, c, w, h) => {
    for (let i = r; i < r + h; i++) for (let j = c; j < c + w; j++) if (grid[i] && grid[i][j]) return true;
    return false;
  };
  for (const k of keys) {
    const s = spanOfIndependently(REG, k);
    if (!s) continue;
    const [w, h] = s;
    outer: for (let r = 0; ; r++) {
      for (let c = 0; c + w <= COLS; c++) {
        if (busy(r, c, w, h)) continue;
        for (let i = r; i < r + h; i++) { if (!grid[i]) grid[i] = []; for (let j = c; j < c + w; j++) grid[i][j] = 1; }
        if (r + h > rows) rows = r + h;
        break outer;
      }
    }
  }
  return rows;
}
// v61.93 起行数是量出来的（把剩下的地方分给各行），sandbox 里量不到就按兜底的 7 行算。
// v61.97：第一页不再单独少一行——页面能上下滑，硬减一行会把日历挤到第二页。
const ROWCAP = 6;
const reach = (L, fr) => {
  const s = new Set();
  L.forEach(a => (a || []).forEach(k => { if (!/^sp_/.test(k)) s.add(k); }));
  Object.keys(fr.current).forEach(f => { if (s.has(f)) (fr.current[f].keys || []).forEach(k => s.add(k)); });
  return s;
};

// 组件全在一页上：24 格是够的，但排出来是 7 行——第 7 行在 overflow-hidden 底下，看不见也点不到
const WIDGETS_7ROWS = ["w_map", "w_us", "w_muyu", "w_card", "w_wheel", "w_music"];

test("这组组件确实会排出超过 6 行（不然这条测试是空转的）", () => {
  const { REG } = makeHome({ 0: [] }, {});
  const raw = denseRows(REG, WIDGETS_7ROWS);
  assert.ok(raw > ROWCAP, "这组样本本身只有 " + raw + " 行，卡不出问题，得换一组");
  let cells = 0;
  for (const k of WIDGETS_7ROWS) { const s = spanOfIndependently(REG, k); cells += s[0] * s[1]; }
  assert.ok(cells <= 24, "样本得是【格数没超但行数超了】才说明只按格数卡不住，现在 " + cells + " 格");
});

test("买单：任何一页都不许排到 6 行以外", () => {
  const cases = {
    组件挤出第七行: { 0: WIDGETS_7ROWS.slice(), 1: [] },
    满页app: { 0: ["cast", "ties", "phone", "cwallet", "lore", "memlib", "diary", "memo", "study", "fanfic",
      "weekly", "carry", "theater", "impression", "read", "debate", "shop", "dwell", "assistant",
      "anon", "rescue", "stylelab", "loungeapp", "vpscodex"], 1: [] },
    日历加一堆: { 0: ["w_cal", "w_us", "w_card", "w_music", "w_memo", "cast", "ties"], 1: [] },
    组件全堆一起: { 0: ["w_cal", "w_map", "w_muyu", "w_wheel", "w_us", "w_card", "w_music", "w_memo", "w_weather", "w_ledger"], 1: [] },
    空布局: {}
  };
  for (const [name, saved] of Object.entries(cases)) {
    const { api, REG } = makeHome(saved, {});
    const L = api.buildLayout(saved);
    L.forEach((keys, pi) => {
      const r = denseRows(REG, keys);
      assert.ok(r <= ROWCAP, name + " 的第 " + (pi + 1) + " 页排了 " + r + " 行，超出屏幕看不到了");
    });
  }
});

test("挤到下一页也不许把东西挤丢", () => {
  const { api, REG, foldersRef } = makeHome({ 0: WIDGETS_7ROWS.slice(), 1: ["cast", "ties"] }, {});
  const L = api.buildLayout({ 0: WIDGETS_7ROWS.slice(), 1: ["cast", "ties"] });
  const got = reach(L, foldersRef);
  for (const k of WIDGETS_7ROWS.concat(["cast", "ties"])) assert.ok(got.has(k), k + " 被挤没了");
  // 注册表里所有 app 都得在某一页上找得到
  Object.keys(REG).forEach(k => { if (REG[k] && REG[k].kind === "app") assert.ok(got.has(k), k + " 从主屏消失了"); });
});

test("从满页文件夹里拿出来的东西，落点也要在看得见的行里", () => {
  const full = WIDGETS_7ROWS.slice(0, 5).concat(["f_1", "cast", "ties", "phone", "cwallet"]);
  const { api, st, foldersRef, REG } = makeHome({ 0: full, 1: [], 2: [] }, { f_1: { name: "杂物", keys: ["shop", "dwell"] } });
  api.removeFromFolder("f_1", "shop");
  const L = api.buildLayout(st.layout);
  assert.ok(reach(L, foldersRef).has("shop"), "购物又不见了");
  L.forEach((keys, pi) => assert.ok(denseRows(REG, keys) <= ROWCAP, "第 " + (pi + 1) + " 页排了太多行"));
});
