// 她 2026-09-03 一口气报的那几条，这里钉住其中五条。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const R = f => fs.readFileSync(path.join(__dirname, "..", f), "utf8");
const comp = R("js/components.js"), ui = R("js/theme-studio-ui.js"), st = R("js/theme-studio.js"), scr = R("js/screens.js");

// ①「行程这个颜色改不了，改成跟随框的颜色」
test("此刻行程那条不再写死主题底色，透明＝跟着底下那层走", () => {
  const i = comp.indexOf('"data-wk": "now"');
  assert.ok(i > 0, "行程条没有挂点");
  const seg = comp.slice(i, i + 400);
  assert.match(seg, /: "transparent"\), borderBottom/);
  assert.doesNotMatch(seg, /"rgba\(255,255,255,0\.45\)" : t\.bg\)/, "还在写死 t.bg");
});

// ②「粉色的发送键也改成好看点的颜色」
test("发送键跟主题强调色走，不再是气泡粉", () => {
  const i = comp.indexOf('"data-wk": "send"');
  assert.ok(i > 0, "发送键没有挂点");
  const seg = comp.slice(i, i + 300);
  assert.match(seg, /background: t\.accent/);
  assert.doesNotMatch(seg, /BUBBLE_SKIN\.myBg/);
});

// ③「预览 30 秒也没用，退出界面就没了」
test("离开主题台不再撤销预览——那个按钮的用处就是出去逛", () => {
  assert.match(ui, /useEffect\(\(\) => \(\) => \{ clearTimeout\(previewTimer\.current\); \}, \[\]\);/);
  assert.doesNotMatch(ui, /if \(studio\.isPreviewing\(\)\) studio\.cancelPreview\(\);/);
  // 30 秒到点自动撤销仍旧由 studio 自己那个计时器负责
  assert.match(st, /timer = setTimeout\(cancelPreview, PREVIEW_MS\)/);
});

// ④ 预览里的名字 + 颜色铺满整框
// v62.02 撤了：这一条钉的是那个 iframe 假页面里的细节（秋秋这个名字、聊天页铺满框），
// 而那整块已经删掉了（她：「应用前预览也根本没有，删了吧」）。
// 那两处当初是修它修出来的（v61.03 补挂点、v61.05 补铺满）——修了两轮还是对不上，
// 说明该修的不是它。删掉，不留一条钉着不存在的东西的测试。

// ⑤⑥「气泡预设被 css override」+「仿微信做成预设皮肤选择键」
test("气泡皮肤压在主题 CSS 上面，且有一排一键预设（含仿微信）", () => {
  assert.match(comp, /function applyBubbleSkinCSS\(\)/);
  assert.match(comp, /document\.head\.appendChild\(el\);/, "皮肤那张 style 要重新 append 才排在主题后面");
  assert.match(comp, /\[data-wk="bubble"\]\[data-me="1"\]/);
  // 预设：出厂 + 仿微信 至少要有
  const m = comp.match(/const BUBBLE_PRESETS = \[[\s\S]*?\n\];/);
  assert.ok(m, "找不到 BUBBLE_PRESETS");
  assert.match(m[0], /key: "wechat", name: "仿微信"/);
  // 一处画两处用：设置里那一处 + 单聊 ••• 那一处
  assert.equal((comp.match(/h\(BubbleSkinPresets/g) || []).length, 1, "单聊那一处没接或接了两遍");
  assert.match(scr, /h\(BubbleSkinPresets, \{ onPick:/, "气泡皮肤设置里那一处没接");
  assert.equal((comp.match(/function BubbleSkinPresets/g) || []).length, 1, "这排按钮不许抄成两份");
});

// ⑦「设置每一个界面可以存 5 种预设」
test("每一页 5 个槽位，另有只读的内置预设", () => {
  assert.match(st, /const SLOT_MAX = 5;/);
  // 简写导出（pageSlots）和显式写法（pageSlots: pageSlots）都算
  ["pageSlots", "saveSlot", "clearSlot"].forEach(f =>
    assert.match(st, new RegExp("[,{]\\s*" + f + "\\s*[,}:]"), f + " 没导出"));
  // v61.13：五套聊天皮肤都在这一栏里（她要的是「点一下灌进编辑框还能自己改」，
  // 不是另开一页开关）。两页共用同一份 CHAT_SKINS。
  assert.match(st, /const CSS_BUILTINS = \{ thread: CHAT_SKINS, gthread: CHAT_SKINS \};/);
  ["仿微信", "仿 LINE", "仿 Telegram", "仿 WhatsApp", "仿 Insta DM"].forEach(nm =>
    assert.ok(st.indexOf('["' + nm + '"') >= 0, "内置里少了「" + nm + "」"));
  // 一处画、五处用：骨架只能有一份，不许各写一套 CSS
  assert.equal((st.match(/data-wk=\\?"bubble\\?"\]\[data-me/g) || []).length <= 4, true,
    "看起来有人把骨架又抄了一份，五套的差别只该是那十几个数");
  assert.match(ui, /studio\.pageSlots\(page\)/);
  assert.match(ui, /studio\.saveSlot\(page, i, nm, cur\)/);
});
