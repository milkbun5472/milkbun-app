const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const comp = fs.readFileSync(path.join(__dirname, "..", "js", "components.js"), "utf8");
const grab = (a, b, cap) => {
  const i = comp.indexOf(a), j = comp.indexOf(b, i);
  assert.ok(i > 0 && j > i && (!cap || j - i < cap), "抠不出：" + a);
  return comp.slice(i, j);
};
const hub = grab("function AnonHub({", "// 匿名箱：仿 QQ 主页");
const box = grab("function AnonBox({", "\n}\n", 14000);
const ink = (() => {
  const i = comp.indexOf("const ANON_INK = {"), j = comp.indexOf("};", i);
  assert.ok(i > 0 && j > i, "抠不出 ANON_INK");
  return new Function(comp.slice(i, j + 2) + "\nreturn ANON_INK;")();
})();
// WCAG 对比度
const srgb = c => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
const relLum = hex => { const v = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)); return 0.2126 * srgb(v[0]) + 0.7152 * srgb(v[1]) + 0.0722 * srgb(v[2]); };
const contrast = (a, b) => { const l1 = relLum(a), l2 = relLum(b); return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05); };

// 她 2026-08-30：「这个框颜色没对齐你修一下」
// 病因：<button> 上写了 min-height，浏览器就把内容【竖直居中】——量出来顶上空了 11.7px，
// 而左右只有 1px 的描边，所以那条彩色抬头浮在卡片里、对不齐。
test("卡片是 flex 列，抬头才贴着卡片顶边", () => {
  const card = grab('return h("button", { key: row.char.id', "h(Empty, { text: \"还没有可以问的人\" })", 2600);
  // ⚠️必须盯【按钮自己那一行】：里面正文那层也是 flex 列，松着写会被它顶过去
  const btnStyle = card.split("\n")[0];
  assert.match(btnStyle, /minHeight: 174/, "卡片的最小高度没了（那正是会触发居中的那一条）");
  assert.match(btnStyle, /display: "flex", flexDirection: "column"/, "按钮本身没排成 flex 列，min-height 会把内容竖直居中");
  assert.match(card, /height: 58, flexShrink: 0/, "抬头会被挤扁");
  assert.match(card, /padding: "12px 12px 13px", flex: 1, display: "flex", flexDirection: "column"/, "正文没撑满剩下的高度");
  assert.match(card, /marginTop: "auto", paddingTop: 9/, "最新那条问句没贴到卡片底部");
});

// 她 2026-08-30：「UI 和背景也弄符合主题一点」——匿名是夜里投进去的一张纸条
test("匿名问答自己是一块夜色，不是白天那套", () => {
  const i = comp.indexOf("function anonNightBg()"), j = comp.indexOf('].join(", ");', i);
  assert.ok(i > 0 && j > i && j - i < 1200, "抠不出 anonNightBg");
  const bg = comp.slice(i, j);
  assert.ok((bg.match(/radial-gradient/g) || []).length >= 3, "那两团光和压边没了");
  assert.match(bg, /repeating-linear-gradient/, "那层极细的横扫线没了");
  assert.match(bg, /linear-gradient\(168deg/, "底色那层没了");
  assert.equal((hub + box).match(/background: anonNightBg\(\)/g).length, 2, "正门和匿名箱要用同一块夜色");
});

test("夜色上的字够亮——不然是一屏看不见的字", () => {
  assert.ok(contrast(ink.ink, ink.bg) >= 7, "正文对比度只有 " + contrast(ink.ink, ink.bg).toFixed(1) + "，太暗");
  assert.ok(contrast(ink.hot, ink.bg) >= 4.5, "强调色在夜色上看不清");
  assert.ok(contrast(ink.cool, ink.bg) >= 4.5, "次强调色在夜色上看不清");
  assert.ok(relLum(ink.bg) < 0.05, "底不够暗，就不像夜里了");
});

// 深色里最容易犯的错：把浅色主题里「填色块的字色」原样搬过来
test("填色的按钮和胶囊，字用底色，不是半透明的卡片色", () => {
  assert.ok(!/color: A\.card/.test(hub + box), "还有地方拿半透明白当字色——那会变成一块看不见字的白板");
  assert.match(box, /background: A\.ink,\s*\n?\s*color: A\.bg/, "「我要匿名问」那个按钮的字色不对");
});

test("这两页不再直接用白天那套颜色", () => {
  [["AnonHub", hub], ["AnonBox", box]].forEach(([name, seg]) => {
    const code = seg.split("\n").filter(l => !/^\s*\/\//.test(l)).join("\n");
    const left = (code.match(/\bt\.(ink|sub|fog|line|bg2|accent|tint)\b/g) || []);
    assert.deepEqual(left, [], name + " 里还留着白天的颜色，在夜色上看不见：" + left.join(" "));
    assert.match(seg, /const A = ANON_INK;/, name + " 没接上夜色的那套颜色");
  });
});
