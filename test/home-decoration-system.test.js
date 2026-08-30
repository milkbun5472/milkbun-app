const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const comp = fs.readFileSync(path.join(__dirname, "..", "js", "components.js"), "utf8");

function between(a, b) {
  const i = comp.indexOf(a);
  const j = comp.indexOf(b, i);
  assert.ok(i >= 0 && j > i, `找不到代码段：${a}`);
  return comp.slice(i, j);
}

test("桌面装饰把内容、样式与位置分开持久化", () => {
  const home = between("function Home({", "// 主页名片");
  assert.match(home, /x_homeDecorations/);
  assert.match(home, /x_homeWidgetStyles/);
  assert.match(home, /x_homeLayout/);
  assert.match(home, /imgToVault\(data\)/, "照片必须进现有图片金库，不能把大图硬塞进桌面 JSON");
});

test("组件库提供照片框、字句卡和日期签", () => {
  const library = between('showDecorLibrary && h(Sheet', "// 主页名片");
  assert.match(library, /\[\["photo", "▣", "照片框"\], \["quote", "“", "字句卡"\], \["date", "31", "日期签"\]\]/);
  assert.match(library, /放到桌面上/);
  assert.match(comp, /if \(it\.which === "photo"\) return \[2, 2\]/);
  assert.match(comp, /if \(it\.which === "quote"\) return \[4, 1\]/);
});

test("预设不是只换颜色：至少六套并包含几何、边框、材质和留白", () => {
  const presets = between("const HOME_WIDGET_PRESETS", "function HomeDecorItem");
  for (const id of ["native", "soft", "paper", "polaroid", "film", "editorial"]) {
    assert.match(presets, new RegExp(`id: "${id}"`));
  }
  assert.match(presets, /borderRadius/);
  assert.match(presets, /padding/);
  assert.match(presets, /boxShadow/);
  assert.match(presets, /backdropFilter/);
});

test("长按旧组件或装饰开换皮；普通 App 仍进原来的整理模式", () => {
  const gestures = between("const onTS =", "const onTM =");
  assert.match(gestures, /kindOf\(key\) === "widget" \|\| kindOf\(key\) === "decor"/);
  assert.match(gestures, /setStyleKey\(key\)/);
  assert.match(gestures, /else pickUp\(\)/, "普通 App/文件夹的长按整理链不能被装饰面板劫持");
  const sheet = between("styleKey && REG[styleKey]", "showDecorLibrary && h(Sheet");
  assert.match(sheet, /整理位置/);
  assert.match(sheet, /只换外观，不改组件原来的功能/);
});

test("主屏安全区与唯一根布局铁律未被装饰系统改写", () => {
  const home = between("function Home({", "// 主页名片");
  assert.match(home, /height: "100vh"/);
  assert.match(home, /className: "relative flex-1 min-h-0 overflow-hidden pt-3 flex flex-col"/);
  assert.match(home, /top: "calc\(env\(safe-area-inset-top\) \+ 10px\)"/,
    "编辑态装饰入口必须跟随主屏自己的安全区公式");
});
