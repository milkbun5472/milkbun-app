// 整理的时候末尾永远挂一张空页（她 2026-09-05：「多开几页主页这样以后东西多了也够放」）。
// 在这之前新的一页【只能靠溢出自己长出来】：页面全排满时她想把一个东西挪到新的一页
// 是做不到的——没有那一页，就没有落点。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const comp = fs.readFileSync(path.join(__dirname, "..", "js", "components.js"), "utf8");
const grab = (a, b) => { const i = comp.indexOf(a), j = comp.indexOf(b, i); assert.ok(i > 0 && j > i, "抠不出：" + a); return comp.slice(i, j); };

const DEFAULT_FOLDERS = new Function(grab("const DEFAULT_FOLDERS = {", "function Home({") + "\nreturn DEFAULT_FOLDERS;")();
function makeHome(editMode, folders) {
  const src = [
    "const widgetSizes = {};",
    "const editMode = " + (editMode ? "true" : "false") + ";",
    grab("const HOME_SIZE_PRESETS = [", "function homeWidgetPresetStyle"),
    grab("  const DEFAULT_LAYOUT = [", "  const SP_RE = /^sp_/;"),
    grab("  const SP_RE = /^sp_/;", "  // 存档 + 注册表 → 完整布局"),
    grab("  function buildLayout(saved) {", "  function persistFolders(nf)")
  ].join("\n");
  const regSrc = grab("  const REG = {", "\n  };") + "\n  };";
  const REG = new Function(regSrc.replace(/G:[^,}]+/g, "G: null") + "\nreturn REG;")();
  const foldersRef = { current: JSON.parse(JSON.stringify(folders || {})) };
  return new Function("REG", "foldersRef", src + "\nreturn { buildLayout, HOME_MAX_PAGES };")(REG, foldersRef);
}
const real = p => (p || []).filter(k => !/^sp_/.test(k));
// 一页 24 格，用 1×1 的 app 铺满
const APPS = ["cast", "ties", "phone", "shop", "memlib", "anon", "yanqiu", "dreamjournal"];
const fullPage = n => Array.from({ length: 24 }, (_, i) => APPS[(n * 7 + i) % APPS.length] + "#" + n + "_" + i);

test("整理时末尾多一张空页，可以把东西挪过去", () => {
  const api = makeHome(true);
  const L = api.buildLayout({ 0: ["w_card", "cast"], 1: ["ties"] });
  assert.equal(real(L[L.length - 1]).length, 0, "整理态末尾那一页得是空的");
  assert.ok(L.length >= 3, "本来两页，整理时该多出一张空的，实际 " + L.length + " 页");
});

test("不在整理态就不挂那张空页——平时不该多一片空白可以滑", () => {
  const api = makeHome(false);
  const a = api.buildLayout({ 0: ["w_card", "cast"], 1: ["ties"] });
  const b = makeHome(true).buildLayout({ 0: ["w_card", "cast"], 1: ["ties"] });
  assert.equal(b.length, a.length + 1, "整理态该刚好多一页，平时不该多");
});

test("末尾本来就是空页时不再往上堆——她自己留的空页照旧留着，但不再多挂一张", () => {
  // 用她 2026-09-05 那份真存档的形状：七页，后面三页是空的
  // 用她 2026-09-05 那份真存档的形状：东西都收在文件夹里，后面几页是空的
  const api = makeHome(true, DEFAULT_FOLDERS);
  const saved = { 3: [], 4: [], 5: [], 6: [] };
  const L0 = makeHome(false, DEFAULT_FOLDERS).buildLayout({});
  L0.forEach((p, i) => { saved[i] = p.filter(k => !/^sp_/.test(k)); });
  const before = Object.keys(saved).length;
  assert.ok(before >= 5, "样本得真的有几页空的在末尾");
  const L = api.buildLayout(saved);
  assert.equal(L.length, before, "末尾已经是空页了，不该再挂一张：本来 " + before + " 页，现在 " + L.length + " 页");
  assert.equal(real(L[L.length - 1]).length, 0);
});

test("页数封顶，而且封顶那一页不再往下溢——再溢就没有下一页接着，东西会凭空消失", () => {
  const api = makeHome(true, DEFAULT_FOLDERS);
  // REG 里的 key 一共就四十来个，堆不出 12 页真数据；页数封顶按【行为】判，
  // 「溢不出去的怎么办」按【源码】判——这一条只有一条分支，抄回原处比编一份假存档诚实。
  const saved = {};
  for (let i = 0; i < 40; i++) saved[i] = [];
  assert.ok(api.buildLayout(saved).length <= api.HOME_MAX_PAGES,
    "存档里写了 40 页也不许真排出 40 页");
  const seg = comp.slice(comp.indexOf("      var cw = 0, ckeep = [], cspill = [];"), comp.indexOf("      out[ci] = ckeep;\n      if (cspill.length)"));
  assert.match(seg, /ci \+ 1 >= HOME_MAX_PAGES\) \{ out\[ci\] = ckeep\.concat\(cspill\); continue; \}/,
    "封顶那一页必须把溢出的收回自己身上；丢掉＝东西凭空消失");
});
