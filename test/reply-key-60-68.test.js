const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..");
const comp = fs.readFileSync(path.join(root, "js/components.js"), "utf8");
const _i = comp.indexOf("const MAPLE_D");
const key = comp.slice(_i, comp.indexOf("\n// 代付请求卡", _i));

// 「让 TA 回复」那个键。她 2026-09-02 点的名：「那个回复键我想要枫叶」。
// 在这之前退回过三版：黑圆圈 + ✦（「之前也是参考的嘤」）、他的脸（「看着怪吓人的」）、
// 一枚空气泡。所以这一条钉的是：图案是自己画的、是一片枫叶、四处同一个键。

// 路径是相对指令（m/l/c），只取每段的落点走成绝对坐标——够验对称和外形了
function anchors(d) {
  const toks = d.replace(/([mlczMLCZ])/g, " $1 ").trim().split(/[\s,]+/);
  const out = []; let x = 0, y = 0, i = 0, cmd = "";
  while (i < toks.length) {
    const tk = toks[i];
    if (/^[mlczMLCZ]$/.test(tk)) { cmd = tk; i++; continue; }
    if (cmd === "z" || cmd === "Z" || !cmd) { i++; continue; }
    const n = (cmd === "c" || cmd === "C") ? 6 : 2;
    const v = toks.slice(i, i + n).map(Number); i += n;
    if (v.length < n || v.some(q => !Number.isFinite(q))) break;
    x += v[n - 2]; y += v[n - 1];
    out.push([Math.round(x * 10) / 10, Math.round(y * 10) / 10]);
    if (cmd === "m") cmd = "l";
  }
  return out;
}
const dm = key.match(/const MAPLE_D = "([^"]+)"/);
const dStr = dm ? dm[1] : "";
const P = anchors(dStr);

test("既不借那颗星，也不拿脸当图案，四处同一个键", () => {
  assert.equal((comp.match(/ISpark/g) || []).length, 0, "✦ 还在");
  assert.equal((key.match(/Avatar/g) || []).length, 0, "键上不许再有脸");
  assert.equal((comp.match(/h\(ReplyKey, \{/g) || []).length, 4,
    "单聊线上 / 单人线下 / 群线下 / 群线上，四处都是同一个键");
});

test("叶子是一条闭合路径，左右对称（v60.72 换成她给的那片真枫叶）", () => {
  assert.ok(dStr.trim().endsWith("z"), "路径没闭合");
  assert.ok(P.length >= 20, "点太少——这一片是五瓣带深凹口的枫叶，不是几个尖");
  const xs = P.map(p => p[0]), ys = P.map(p => p[1]);
  // 容差 15/1024（≈1.4%）：这一片是照旗子那片描的，两边差个十来个单位，肉眼看不出来。
  // 但歪成星形、缺一瓣、或者哪一侧塌了，都会在这一步露馅。
  for (const [x, y] of P) {
    assert.ok(P.some(q => Math.abs(q[0] - (1024 - x)) < 15 && Math.abs(q[1] - y) < 15),
      "(" + x + "," + y + ") 找不到对称的那一半——叶子歪了");
  }
  assert.ok(Math.max(...xs) - Math.min(...xs) >= 500, "叶面不够宽");
  // 叶柄：最底下那两个点紧挨着中轴，而且比叶面低一截（缩到 23px 全靠这根柄）
  const blade = Math.max(...ys.filter(y => y <= 600));
  const bottom = P.filter(p => p[1] > 600);
  assert.equal(bottom.length, 2, "叶柄是两个点一根柄");
  assert.ok(Math.abs(bottom[0][0] - bottom[1][0]) <= 30, "柄太粗了，看着像楔子不像柄");
  assert.ok(Math.max(...ys) - blade >= 90, "柄太短了，缩小之后整片就成了星");
  // viewBox 切在叶子的外框上，键里那片才是满的
  assert.match(key, /const MAPLE_VB = "246 78 532 686"/);
  assert.match(key, /viewBox: MAPLE_VB/);
});

test("生成中：叶子红了，还在轻轻晃（不是转圈的加载环）", () => {
  assert.match(key, /const lit = sending \? t\.accent : t\.ink/, "生成中该变红");
  assert.equal((key.match(/animate-spin/g) || []).length, 0, "转整圈就成了通用加载环");
  assert.match(key, /@keyframes wk-maple\{0%\{transform:rotate\(-8deg\)/);
  assert.match(key, /50%\{transform:rotate\(11deg\)/, "要来回晃，不能只往一边转");
  assert.match(key, /animation: "wk-maple/, "晃只在生成中那一档");
});

test("群线上那两档：实心／空心，不是只换个颜色", () => {
  // hold=true 只回一轮（回完停下等你）；false 他们自己会接着聊
  assert.match(key, /fill: hold === true \? "none" : lit/);
  assert.match(comp, /hold: !!gHold/, "群线上要把这一档传进来");
});

test("四处各自的说法对得上", () => {
  assert.match(comp, /h\(ReplyKey, \{\n?\s*sending: sending, disabled: sending \|\| bk\.theyBlocked/, "单聊线上");
  assert.match(comp, /h\(ReplyKey, \{ sending: sending, disabled: sending, title: "让 Ta 演绎"/, "单人线下");
  assert.match(comp, /h\(ReplyKey, \{ sending: sending, disabled: sending, title: "让他们演绎"/, "群线下");
  assert.match(comp, /gs\.spectate \? "让他们演一轮（回完仍旧等你）" : "让他们回一轮（回完仍旧等你）"/, "群线上");
});

test("被拉黑仍然戳不动，且说得清为什么", () => {
  assert.match(comp, /disabled: sending \|\| bk\.theyBlocked/);
  assert.match(comp, /bk\.theyBlocked \? "TA 拉黑了你，无法回复" : "让 TA 回复"/);
  assert.match(key, /disabled: disabled/);
});

test("点得着：还是 40px（mobile-ui-layout 那条手感线）", () => {
  assert.match(key, /width: 40, height: 40, borderRadius: 999/);
});
