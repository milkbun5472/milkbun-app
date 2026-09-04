// v62.42 她 2026-09-04：「能不能直接把我发给你的单个图标直接套进去 app 做一套预设皮肤，
// 随时可以用或者切换成别的，还是说这种只能我一个一个套」＋「可以搞那个开关」。
//
// 落了三样：整套（ICON_PACKS，仓库自带 img/icons/<套>/<appKey>.png）、
// 「图标自带底，不套玻璃」开关（iconBare）、一次多张按文件名对 App（chooseIcons）。
// 这份测试钉的是三处最容易走散的接口：
//   1. 登记了的 key 盘上必须真有那张 png（写了没文件＝主屏一个 404 空框）；
//   2. 选图那条链的顺序：她换的 → 当前整套 → 自带图 → 线稿，只许有一处答案；
//   3. 主题包导出/导入必须带着 iconPack / iconBare 走，不然换台设备整套就丢了。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const root = path.join(__dirname, "..");
const ts = fs.readFileSync(path.join(root, "js/theme-studio.js"), "utf8");
const comp = fs.readFileSync(path.join(root, "js/components.js"), "utf8");
const ui = fs.readFileSync(path.join(root, "js/theme-studio-ui.js"), "utf8");

// 把 theme-studio.js 装进一个假 window 里跑一遍，拿到真正的 ThemeStudio
function loadStudio() {
  const store = {};
  const g = {
    localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } },
    document: { getElementById: () => null, createElement: () => ({ set textContent(v) {}, get textContent() { return ""; } }), head: { appendChild() {} }, readyState: "complete", addEventListener() {} },
    dispatchEvent() {}, CustomEvent: function (n, o) { this.type = n; this.detail = o && o.detail; },
    location: { search: "" }, URLSearchParams: URLSearchParams
  };
  g.window = g;
  vm.runInNewContext(ts, g);
  return g.ThemeStudio;
}

test("登记进整套的每个 key，盘上都得真有那张 png", () => {
  const s = loadStudio();
  assert.ok(s.ICON_PACKS && typeof s.ICON_PACKS === "object");
  for (const [pk, pack] of Object.entries(s.ICON_PACKS)) {
    assert.match(pack.dir, /^img\/icons\/[a-z0-9_-]+\/$/, pk + " 的目录写法不对");
    assert.ok(fs.existsSync(path.join(root, pack.dir)), pk + " 的目录 " + pack.dir + " 不在盘上");
    for (const k of pack.keys) {
      assert.ok(fs.existsSync(path.join(root, pack.dir + k + ".png")), pk + " 登记了 " + k + "，可 " + pack.dir + k + ".png 不存在");
    }
    // 反过来：盘上有、没登记的也报——那是「发了图、忘了写一行」
    const onDisk = fs.readdirSync(path.join(root, pack.dir)).filter(f => /\.png$/i.test(f)).map(f => f.replace(/\.png$/i, ""));
    for (const k of onDisk) assert.ok(pack.keys.includes(k), pack.dir + k + ".png 在盘上，可 " + pk + " 的 keys 里没登记它");
  }
});

test("整套里的 key 必须是主屏真有的 app（不许对着幽灵 key 放图）", () => {
  const s = loadStudio();
  const REGBLOCK = comp.slice(comp.indexOf("  const REG = {"), comp.indexOf("\n  };", comp.indexOf("  const REG = {")));
  const HOME = [...REGBLOCK.matchAll(/^\s*(\w+): \{ kind: "app", zh: "([^"]+)"/gm)].map(m => m[1]);
  const dock = comp.slice(comp.indexOf("  const dock = [{"), comp.indexOf("  const clearLP = function"));
  const DOCK = [...dock.matchAll(/key: "(\w+)"/g)].map(m => m[1]);
  const ALL = HOME.concat(DOCK);
  for (const pack of Object.values(s.ICON_PACKS)) for (const k of pack.keys) assert.ok(ALL.includes(k), k + " 不是主屏上的 app");
});

test("选图那条链只有一个答案，顺序是 她换的 → 当前整套 → 自带图 → 线稿", () => {
  const fn = comp.slice(comp.indexOf("function appIconSrc(appKey)"), comp.indexOf("function appIconBare("));
  const iRef = fn.indexOf("ThemeStudio.iconRef"), iPack = fn.indexOf("ThemeStudio.packIcon"), iBuiltin = fn.indexOf("APP_BUILTIN_ICON[appKey]");
  assert.ok(iRef > 0 && iPack > iRef && iBuiltin > iPack, "顺序不对：iconRef " + iRef + " packIcon " + iPack + " builtin " + iBuiltin);
  // 文件夹预览、拖动虚影仍然只问 appIconSrc（v62.02 那两次事故的形状）
  assert.ok((comp.match(/appIconSrc\(/g) || []).length >= 4, "有地方自己抄了一份优先级？");
  assert.doesNotMatch(comp, /ThemeStudio\.packIcon\((?!appKey\))/, "packIcon 只许在 appIconSrc 里问一次");
});

test("整套 + 自带底：归一化认得、随主题包一起走", () => {
  const s = loadStudio();
  const p = s.normalize({ iconPack: "autumn", iconBare: 1, icons: { cast: "iv_1" } });
  assert.equal(p.iconPack, "autumn");
  assert.equal(p.iconBare, true);
  assert.equal(s.normalize({ iconPack: "不存在的套" }).iconPack, "", "不认识的套要清成空，别让主屏去找一个不存在的目录");
  assert.equal(s.normalize({}).iconBare, false);
  // apply 之后 packIcon / iconBare 读的是 active
  s.apply({ iconPack: "autumn", iconBare: true });
  assert.equal(s.iconBare(), true);
  const anyKey = s.ICON_PACKS.autumn.keys[0];
  if (anyKey) assert.equal(s.packIcon(anyKey), "img/icons/autumn/" + anyKey + ".png");
  assert.equal(s.packIcon("__nope__"), "");
  // 导出的 profile 走 normalize，所以 iconPack / iconBare 一定在里面
  assert.match(ts, /profile, baseTheme: extras && extras\.baseTheme, wallpaper/, "exportPackage 不再整份带 profile 了？");
});

test("主屏：自带底那一支不套玻璃、线稿永远在玻璃上", () => {
  const gi = comp.slice(comp.indexOf("function GlassIcon("), comp.indexOf("function FolderIcon("));
  assert.match(gi, /const bare = !!customSrc && appIconBare\(\)/, "bare 必须以「有图」为前提");
  assert.match(gi, /bare\s*\?\s*h\("div", \{/, "没有不套玻璃那一支");
  assert.match(gi, /objectFit: bare \? "contain" : "cover"/, "自带底的图要整张露出来，不许裁");
});

test("工作台：整套贴纸纸 + 自带底开关 + 一次多张，三样都在", () => {
  assert.match(ui, /studio\.packList\(\)/, "没有整套那一排");
  assert.match(ui, /patchDraft\(\{ iconPack: pk, iconBare: pk \? !!studio\.ICON_PACKS\[pk\]\.bare : false \}\)/, "选整套时没按那套的 bare 预设开关");
  assert.match(ui, /图标自带底，不套玻璃/);
  assert.match(ui, /patchDraft\(\{ iconBare: !draft\.iconBare \}\)/, "开关拨不动");
  assert.match(ui, /multiple: true, onChange: chooseIcons/, "没有一次多张的入口");
  assert.match(ui, /byName\[k\.toLowerCase\(\)\] = k; byName\[zh\] = k;/, "文件名对 App 得同时认 key 和中文名");
  assert.match(ui, /认不出：/, "认不出的文件必须报出来，不许悄悄丢");
  // 不是一排药丸：贴纸纸是方角小圆角 + 歪一点，选中的不歪
  assert.match(ui, /transform: on \? "none" : "rotate\(-1\.2deg\)"/);
});
