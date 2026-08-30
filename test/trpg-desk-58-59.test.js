const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const src = fs.readFileSync(path.join(__dirname, "..", "js", "trpg.js"), "utf8");
const { trpgDeskBg, trpgHour } = require("../js/trpg.js");
const grab = (a, b, cap) => {
  const i = src.indexOf(a), j = src.indexOf(b, i);
  assert.ok(i > 0 && j > i && (!cap || j - i < cap), "抠不出：" + a);
  return src.slice(i, j);
};
// #rrggbb → 亮度 / 暖冷差（R−B，越大越暖）
const lum = hex => { const v = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)); return 0.299 * v[0] + 0.587 * v[1] + 0.114 * v[2]; };
const warmth = hex => parseInt(hex.slice(1, 3), 16) - parseInt(hex.slice(5, 7), 16);

// 她 2026-08-30：「现在这个米白纯背景有点无聊，让它更贴主题一点」
test("桌面不是一层纯色：羊皮纸 + 方格坐标纸 + 压边的灯", () => {
  const bg = trpgDeskBg("夜");
  assert.ok((bg.match(/repeating-linear-gradient/g) || []).length >= 3, "方格纸或纸纹没了");
  assert.match(bg, /repeating-linear-gradient\(0deg/, "横格没了");
  assert.match(bg, /repeating-linear-gradient\(90deg/, "竖格没了");
  assert.ok((bg.match(/radial-gradient/g) || []).length >= 3, "灯和压边没了");
  assert.match(bg, /linear-gradient\(168deg/, "纸底那层没了");
});

// 时辰是守密人真报的（camp.time.part），不是随手挑的滤镜
test("入夜比清晨更沉更冷，黄昏最暖", () => {
  const P = k => trpgHour(k).paper;
  const L = k => P(k).map(lum).reduce((a, b) => a + b) / 3;
  const W = k => P(k).map(warmth).reduce((a, b) => a + b) / 3;
  assert.ok(L("夜") < L("晨"), "夜里那张桌子该比清晨沉：夜 " + L("夜").toFixed(1) + " vs 晨 " + L("晨").toFixed(1));
  assert.ok(L("深夜") < L("夜"), "深夜还该更沉一点");
  assert.ok(W("夜") < W("晨"), "夜里该偏冷");
  assert.ok(W("暮") > W("晨"), "黄昏该是最暖的那一档");
  assert.ok(trpgHour("夜").dark > trpgHour("晨").dark, "越晚桌沿压得越暗");
});

test("认不出的时辰有兜底，不会画出个 undefined", () => {
  ["", null, undefined, "第七夜", "midnight"].forEach(k => {
    const bg = trpgDeskBg(k);
    assert.ok(!/undefined|NaN/.test(bg), String(k) + " 画出了 undefined");
    assert.equal(bg, trpgDeskBg("昼"), "认不出就该退回白天那一档");
  });
});

test("底真的接到界面上了，而且面板跟着一起换", () => {
  assert.match(src, /const deskBg = trpgDeskBg\(camp && camp\.time \? camp\.time\.part : ""\)/, "底没跟着时辰走");
  assert.match(src, /wrap: \{ position: "fixed", inset: 0, zIndex: 60, background: deskBg/, "整屏壳还是纯色");
  assert.match(src, /zIndex: 119, width: "82%", maxWidth: 340, background: deskBg/, "右边那块面板还是纯色");
});

// 桌面有纹理，透明按钮会糊进去
test("不填色的按钮也得垫一层纸", () => {
  const btn = grab("      btn: fill => ({", "      card: {", 700);
  assert.doesNotMatch(btn, /background: fill \? t\.ink : "transparent"/, "按钮又变透明了，在纹理上看不出是个键");
  assert.match(btn, /rgba\(255,255,255,\.6\d\)/);
});

// 她 2026-08-30：「线索和目标那块要不要也做信息分块这样容易看」
test("面板按块分：每块一个图标 + 标题 + 细线 + 正文", () => {
  const sect = grab("    const sect = (icon, title, right, ...kids) =>", "    const imgSrc =", 1400);
  assert.match(sect, /borderBottom: "1px solid " \+ t\.line/, "标题和正文之间没有分隔线");
  assert.match(sect, /fontFamily: F_DISPLAY/, "块标题还是那种灰色小字，跟正文分不开");
  assert.match(sect, /h\.apply\(null, \["div", \{ style: \{ padding: "9px 11px 10px" \} \}\]\.concat\(kids\)\)/,
    "子节点要展开进 createElement，不然 React 会为数组子节点报 key 警告");
});

test("旅程/队伍/压力/目标/名册/行囊/线索 七块都成块了", () => {
  const names = (src.match(/sect\("[^"]*", "([^"]+)"/g) || []).map(x => x.slice(x.lastIndexOf('", "') + 4, -1));
  assert.deepEqual(names.sort(), ["名册", "压力", "队伍", "线索", "行囊", "旅程", "目标"].sort());
});

test("块名和块里的小标题不重复写一遍", () => {
  const panel = grab("      const panel = panelOpen && h(\"div\", null,", "      // 休团回来", 22000);
  assert.ok(!/S\.lbl[^)]*\}\, "名册"/.test(panel), "名册在块名和块里各写了一遍");
  assert.ok(!/S\.lbl[^)]*\}\, "物品"/.test(panel), "物品那行小标题该删——块名已经叫行囊了");
  assert.ok(!/"线索\(已知事实\)"/.test(panel), "块名已经叫线索了，里面写「已知事实」就够");
  // 一块里装了两样东西的，小标题要留着
  assert.match(panel, /S\.lbl \}, "主线"/);
  assert.match(panel, /"支线" \+ \(fixMode/);
  assert.match(panel, /S\.lbl \}, "已知事实"/);
  assert.match(panel, /S\.lbl \}, "威胁时钟"/);
});
