// 文件口要让手指直接点到 input 本身（她 2026-09-25 报：小米上点不动导入头像）
//
// 原来那一路是「点按钮 → 代码替你 .click() 那个藏起来的 input」。
// 桌面和 iOS 都行，**装到桌面那种壳（MIUI WebView）会把「代码替你点」掐掉**：
// 页面不报错、什么也不发生，看上去就是死按钮。
// 跟 v72.15 主题包那颗是同一族，但病因不同——这次守卫都在
// （产物里 40 处 `.current.click()` 一处不漏），问题是【那一下必须真落在 input 上】。
//
// 所以 AvatarPicker 改成 FilePick：input 铺满触点、透明、压最上面。
// 再留一条不走文件选择器的路（贴一张图）——连选择器都没实现的壳里，只有它还通。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const comp = fs.readFileSync(path.join(__dirname, "..", "js", "components.js"), "utf8");

const slice = (from, to) => {
  const i = comp.indexOf(from), j = comp.indexOf(to, i);
  assert.ok(i > 0 && j > i, "抠不出 " + from);
  return comp.slice(i, j);
};

test("FilePick 把 input 铺满触点，不是藏起来", () => {
  const seg = slice("function FilePick(", "function AvatarPicker(");
  assert.match(seg, /position: "absolute", inset: 0/);
  assert.match(seg, /opacity: 0/);
  // ⚠️display:none / visibility:hidden 的 input 点不到——这正是原来那个病
  assert.ok(!/display: *"none"/.test(seg), "又把 input 藏起来了");
  assert.ok(!/visibility: *"hidden"/.test(seg));
  assert.match(seg, /zIndex: 2/, "没压在最上面就会被触点本身挡住");
  // iOS 上字号小于 16 会把整页放大
  assert.match(seg, /fontSize: 16/);
});

test("AvatarPicker 不再靠代码替你点", () => {
  const seg = slice("function AvatarPicker(", "function Sheet(");
  assert.match(seg, /h\(FilePick, \{/, "没换成 FilePick");
  assert.ok(!/\.current\.click\(\)/.test(seg), "又回到 .current.click() 那条路了");
  assert.ok(!/className: "hidden"/.test(seg), "input 又被 hidden 藏起来了");
  // ⚠️触点那层从 <button> 换成了 <span>，必须显式 inline-flex：
  //   不给宽度会塌成 0，input 虽然 inset:0 盖着，实测是 0×72，手指点不到（真机量出来的）
  assert.match(seg, /style: \{ display: "inline-flex" \}/, "触点没撑开宽度，input 会是 0 宽");
});

test("留着那条不走文件选择器的路", () => {
  const seg = slice("function AvatarPicker(", "function Sheet(");
  assert.match(seg, /onPaste: async ev =>/, "贴一张图那条路没了");
  assert.match(seg, /indexOf\("image\/"\) !== 0/, "没在挑图片类型");
  const fp = slice("function FilePick(", "function AvatarPicker(");
  assert.match(fp, /onPaste: onPaste/, "FilePick 没把 onPaste 透给 input");
});
