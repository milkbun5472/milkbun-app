// 她 2026-09-20：「界面 css 做好了不能导出导入分享界面美化给别人」。
//
// 查下来页面/全局 CSS 本来就在主题包里（连 CSS 里引用的图都跟着走）；
// 真正没在包里的是【聊天气泡皮肤】——它不住在 profile 里，是单独一份存档。
// 顺手把「导入＝全有全无」改成勾选：勾掉的那几样不动她现在的。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const P = f => fs.readFileSync(path.join(__dirname, "..", f), "utf8");
const studio = P("js/theme-studio.js"), ui = P("js/theme-studio-ui.js"), comps = P("js/components.js"), screens = P("js/screens.js");

// ⚠️气泡皮肤原来有两处各写一份 Object.assign + setItem + 重刷 CSS（换预设、设置页保存）。
//   主题包要接上就是第三份 → 先合成一处再接（施工规则/one-public-mechanism）。
test("气泡皮肤只有一处读、一处写", () => {
  assert.ok(comps.includes("function writeBubbleSkin(next) {"), "没有公共那一处");
  assert.ok(comps.includes("function bubbleSkinSnapshot() {"), "没有公共的读");
  // 写 x_bubbleSkin 的地方只剩公共那一处（删 key 的复位不算写）
  const writers = (comps + screens).match(/localStorage\.setItem\("x_bubbleSkin"/g) || [];
  assert.equal(writers.length, 1, "还有别处自己往 x_bubbleSkin 里写");
  assert.ok(/const save = \(\) => \{ writeBubbleSkin\(s\);/.test(screens), "设置页那处没搬过来");
  assert.ok(/return writeBubbleSkin\(bubblePresetSkin\(key\)\);/.test(comps), "换预设那处没搬过来");
  // 盖在出厂值上，不是盖在当前值上——不然上一套的描边/贴纸会残留
  assert.ok(/Object\.assign\(\{\}, BUBBLE_SKIN_DEFAULTS, next \|\| \{\}\)/.test(comps), "没盖在出厂值上，旧皮肤会残留");
});

test("气泡皮肤进包、也从包里出得来", () => {
  assert.ok(/bubbleSkin,? ?assets|bubbleSkin, assets/.test(studio), "装包时没带气泡");
  // v72.52 起装包也能只挑几样（她 2026-09-22 要的「只导出图标／只导出背景」），
  // 所以这一格还多了一道 sel.bubble——没挑气泡就不装它。
  assert.ok(/const bubbleSkin = sel\.bubble && extras && extras\.bubbleSkin \? extras\.bubbleSkin : null;/.test(studio), "装包那份气泡不是调用方给的、或者没跟着勾选走");
  assert.ok(/pkg\.bubbleSkin && typeof pkg\.bubbleSkin === "object"/.test(studio), "拆包时没接住气泡（老包没有这一格也要不炸）");
  assert.ok(/bubbleSkin: typeof bubbleSkinSnapshot === "function" \? bubbleSkinSnapshot\(\) : null/.test(ui), "导出那一步没把当前气泡带上");
});

// ⚠️她自己调了半天的别处，不该被一份包整个抹平
test("导入是勾选，而且合在她现在那份上", () => {
  const i = ui.indexOf("    const mergePick = (pack, sel) => {");
  assert.ok(i > 0, "抠不出 mergePick");
  const seg = ui.slice(i, ui.indexOf("    const applyPack", i));
  assert.ok(/studio\.normalize\(studio\.load\(\)\)/.test(seg), "没读她现在那份——没勾的那几样会被包里的顶掉");
  ["globalCSS", "pageCSS", "pageTokens", "icons", "iconPack", "iconBare", "fonts", "customFonts"].forEach(k => {
    assert.ok(new RegExp(k + ": sel\\.[a-z]+ \\? inc\\." + k + " : cur\\." + k).test(seg), k + " 没跟着勾选走");
  });
  // 勾一下就改预览：她是看着挑的，不是盲选完再按确认
  assert.ok(/const togglePick = k => \{/.test(ui) && /if \(incoming\) livePick\(incoming, sel\)/.test(ui), "勾了不立刻改预览");
});

test("基础配色／壁纸／气泡都只在确认后落盘", () => {
  const i = ui.indexOf("    const commit = () => {");
  const seg = ui.slice(i, ui.indexOf("\n    const cancel", i));
  assert.ok(/if \(pendingBubble && typeof writeBubbleSkin === "function"\) writeBubbleSkin\(pendingBubble\)/.test(seg),
    "气泡没在确认时落盘，或者绕过了公共那一处");
  assert.ok(/setPendingBubble\(null\); setIncoming\(null\)/.test(seg), "应用完没把那一包收起来");
  // 预览阶段不许写存档
  const pv = ui.slice(ui.indexOf("    const livePick = (pack, sel) => {"), ui.indexOf("    const applyPack"));
  assert.ok(!/writeBubbleSkin|studio\.commit|onSaveTheme|onSaveWallpaper/.test(pv), "预览那一步就写存档了——她还没点确认");
});

test("包里没有的那几样要标出来、点不动", () => {
  assert.ok(/这份包里带了这些，勾掉的不会动你现在的/.test(ui), "没告诉她这包里有什么");
  assert.ok(/disabled: !x\.has/.test(ui), "包里没有的那格还点得动");
  assert.ok(/（这份包里没有）/.test(ui), "包里没有的那格没标出来");
  // v72.52：这张名单搬进了 ThemeStudio.PACK_PARTS——导出挑哪几样、导入勾哪几样、
  // 聊天气泡那一页单独收发哪一样，三处都问它要（施工规则/one-public-mechanism）。
  ["页面／全局 CSS", "图标", "字体", "基础配色", "壁纸", "聊天气泡"].forEach(x =>
    assert.ok(studio.includes('"' + x + '"'), "少了一格：" + x));
  assert.ok(!/"基础配色"/.test(ui), "界面里又自己写了一份名单");
});
