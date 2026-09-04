// 默认主屏照她自己那套摆（她 2026-09-03 给了三张自己主屏的截图：
// 「按这个布局把 app 的默认布局摆成这样」）。
// 原来第三页是二十多个图标铺一屏——新装的人一进来就是一面图标墙；
// 她的摆法是【每页一个整行组件领头，app 收进文件夹】。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const comp = fs.readFileSync(path.join(__dirname, "..", "js", "components.js"), "utf8");

const grab = (start, end, ret) => {
  const i = comp.indexOf(start), j = comp.indexOf(end, i);
  assert.ok(i > 0 && j > i, "抠不出 " + start);
  return new Function(comp.slice(i, j) + "\nreturn " + ret + ";")();
};
const FOLDERS = grab("const DEFAULT_FOLDERS = {", "function Home({", "DEFAULT_FOLDERS");
const LAYOUT = grab("  const DEFAULT_LAYOUT = [", "  const SP_RE = /^sp_/;", "DEFAULT_LAYOUT");
const REG = (() => {
  const i = comp.indexOf("  const REG = {"), j = comp.indexOf("\n  };", i);
  return new Function(comp.slice(i, j).replace(/G:[^,}]+/g, "G: null") + "\n  };\nreturn REG;")();
})();

test("每一页都由组件领头，不是一面图标墙", () => {
  assert.equal(LAYOUT.length, 3, "页数变了");
  LAYOUT.forEach((page, i) => {
    assert.match(page[0], /^w_/, "第 " + (i + 1) + " 页不是组件打头");
    const icons = page.filter(k => !/^w_/.test(k));
    assert.ok(icons.length <= 8, "第 " + (i + 1) + " 页塞了 " + icons.length + " 个图标，又成图标墙了");
  });
});

test("一个 app 都没丢：REG 里的每个 app 要么在页上，要么在默认文件夹里", () => {
  const placed = new Set();
  LAYOUT.forEach(p => p.forEach(k => placed.add(k)));
  Object.keys(FOLDERS).forEach(fid => {
    assert.ok(placed.has(fid), "文件夹「" + FOLDERS[fid].name + "」没摆到任何一页上");
    FOLDERS[fid].keys.forEach(k => placed.add(k));
  });
  const missing = Object.keys(REG).filter(k => REG[k].kind === "app" && !placed.has(k));
  assert.deepEqual(missing, [], "这几个 app 新装的人找不到：" + missing.join(" "));
});

test("同一个 app 不许出现在两个文件夹里", () => {
  const seen = {}, dup = [];
  Object.keys(FOLDERS).forEach(fid => FOLDERS[fid].keys.forEach(k => {
    if (seen[k]) dup.push(k + "（" + seen[k] + " / " + FOLDERS[fid].name + "）");
    seen[k] = FOLDERS[fid].name;
  }));
  assert.deepEqual(dup, [], "重了：" + dup.join("；"));
});

test("只在第一次装的时候铺：已经自己摆过的人一律不动", () => {
  const seg = comp.slice(comp.indexOf("const [folders, setFolders] = useState"), comp.indexOf("const foldersRef"));
  assert.match(seg, /if \(st && Object\.keys\(st\)\.length\) return st;/, "存过的文件夹会被默认值盖掉");
  assert.match(seg, /loadJSON\("x_homeLayout", \{\}\)/, "没看布局：老用户会凭空多出九个文件夹");
  assert.match(seg, /JSON\.parse\(JSON\.stringify\(DEFAULT_FOLDERS\)\)/, "默认值被直接引用，用户一改就把常量改了");
});

test("DEFAULT_FOLDERS 定义在组件外面：里面用 const 会撞上暂时性死区", () => {
  assert.ok(comp.indexOf("const DEFAULT_FOLDERS = {") < comp.indexOf("function Home({"),
    "定义排在 Home 里面／后面，useState 初始化那一刻会 ReferenceError，主屏直接白屏");
});

// 她 2026-09-03 的存档抓到的：她自己建过文件夹，所以 x_homeFolders 里【没有】f_def_*，
// 可 buildLayout 补默认项时不过滤，照样把这九个默认文件夹塞回页面——
// 它们占着格子、渲染却是 null，于是那几格「看着空、放不进、连虚线落点都没有」。
test("补默认项时也要过 valid()：不存在的默认文件夹不许占格子", () => {
  const i = comp.indexOf("DEFAULT_LAYOUT.forEach(function (p, dp) {");
  const seg = comp.slice(i, i + 260);
  assert.match(seg, /if \(!seen\[key\] && valid\(key\)\)/, "补回默认项时没过 valid()");
  assert.match(comp, /return p\.filter\(function \(k\) \{ return !seen\[k\] && valid\(k\); \}\)/, "空档那一路也要过");
});
