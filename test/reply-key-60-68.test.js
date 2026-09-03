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

const dm = key.match(/const MAPLE_D = "([^"]+)"\s*\+\s*"([^"]+)"/);
const dStr = dm ? dm[1] + dm[2] : "";
const pts = (dStr.replace(/[MLz]/g, " ").trim().split(/\s+/).map(Number));
const P = [];
for (let i = 0; i < pts.length; i += 2) P.push([pts[i], pts[i + 1]]);

test("既不借那颗星，也不拿脸当图案，四处同一个键", () => {
  assert.equal((comp.match(/ISpark/g) || []).length, 0, "✦ 还在");
  assert.equal((key.match(/Avatar/g) || []).length, 0, "键上不许再有脸");
  assert.equal((comp.match(/h\(ReplyKey, \{/g) || []).length, 4,
    "单聊线上 / 单人线下 / 群线下 / 群线上，四处都是同一个键");
});

test("叶子是自己画的一条闭合路径，左右对称", () => {
  assert.ok(P.length >= 11, "点太少，画不出一片叶子");
  assert.ok(P.every(p => Number.isFinite(p[0]) && Number.isFinite(p[1])), "路径里有解析不出来的数");
  for (const [x, y] of P) {
    assert.ok(P.some(q => Math.abs(q[0] - (24 - x)) < 0.02 && Math.abs(q[1] - y) < 0.02),
      "(" + x + "," + y + ") 找不到对称的那一半——叶子歪了");
  }
});

test("五瓣要宽、叶柄要真——这两样决定它缩到 23px 还是不是叶子", () => {
  // 八版里前七版都是「瓣细 + 柄短」，缩小之后一律变成一颗星。
  const xs = P.map(p => p[0]), ys = P.map(p => p[1]);
  assert.ok(Math.max(...xs) - Math.min(...xs) >= 18, "叶面不够宽，瓣一细就成了星");
  // 叶柄：最底下那两个点必须紧挨着中轴，而且比叶面低一截
  const bottom = P.filter(p => p[1] > 20);
  assert.equal(bottom.length, 2, "叶柄是两个点一根柄");
  assert.ok(Math.abs(bottom[0][0] - bottom[1][0]) <= 2, "柄太粗了，看着像楔子不像柄");
  const blade = Math.max(...ys.filter(y => y <= 20));
  assert.ok(Math.max(...ys) - blade >= 4.5, "柄太短了，缩小之后整片就成了星");
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
