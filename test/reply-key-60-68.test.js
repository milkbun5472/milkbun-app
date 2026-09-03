const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..");
const comp = fs.readFileSync(path.join(root, "js/components.js"), "utf8");
const yq = fs.readFileSync(path.join(root, "js/yanqiu.js"), "utf8");
const _i = comp.indexOf("function ReplyKey(");
const key = comp.slice(_i, comp.indexOf("\n}\n", _i));

// 「让 TA 回复」那个键。她 2026-09-02 点的名：「那个回复键我想要枫叶」，
// 2026-09-03 又改口：「参考言秋在秋声做的……直接偷他那片过来」。
// 在这之前退回过好几版：黑圆圈 + ✦（「之前也是参考的嘤」）、他的脸（「看着怪吓人的」）、
// 一枚空气泡、我自己描的枫叶、真枫叶。所以这一条钉的是：
// 图案是【这个 app 自己有的那片叶子】、只有一份、四处同一个键。

test("既不借那颗星，也不拿脸当图案，四处同一个键", () => {
  assert.equal((comp.match(/ISpark/g) || []).length, 0, "✦ 还在");
  assert.equal((key.match(/Avatar/g) || []).length, 0, "键上不许再有脸");
  assert.equal((comp.match(/h\(ReplyKey, \{/g) || []).length, 4,
    "单聊线上 / 单人线下 / 群线下 / 群线上，四处都是同一个键");
});

test("用的就是言秋那片叶子本人，不是照着又抄一份", () => {
  assert.match(key, /window\.GYanqiuLeaf/, "没去拿他那片");
  assert.match(key, /h\(Leaf, \{ size: 30, color: lit, dash: hold === true \}\)/);
  // ⚠️路径只许有一份：抄一份的话，他哪天改了自己那片，聊天这颗就悄悄跟他分了家
  assert.doesNotMatch(comp, /M38 10C26 10 14 16 12 30c8 2 22-2 26-20z/, "components.js 里又抄了一份叶子");
  assert.match(yq, /M38 10C26 10 14 16 12 30c8 2 22-2 26-20z/, "原件不在 yanqiu.js 了");
  // 那片枫叶连同它的常量整个撤干净，不许留着没人用的
  assert.doesNotMatch(comp, /MAPLE_D|MAPLE_VB/);
});

test("加 dash 是可选参数，秋声那边一个像素都不动", () => {
  assert.match(yq, /const dash = \(props && props\.dash\) \? \{ strokeDasharray: "9 3" \} : null;/);
  // 不传 dash 时 Object.assign 加的是 null，等于什么都没加
  assert.match(yq, /Object\.assign\(\{ d: "M38 10C26/);
});

test("没有圆框，但可点区域还是 40px（mobile-ui-layout 那条手感线）", () => {
  assert.match(key, /width: 40, height: 40, background: "transparent", border: "none"/);
  assert.doesNotMatch(key, /borderRadius: 999/, "圆框还在");
  assert.doesNotMatch(key, /border: "1\.5px solid/, "那圈边还在");
});

test("生成中：叶子上色，还在轻轻晃（不是转圈的加载环）", () => {
  assert.match(key, /const lit = sending \? t\.accent : t\.ink/, "生成中该变色");
  assert.equal((key.match(/animate-spin/g) || []).length, 0, "转整圈就成了通用加载环");
  assert.match(key, /@keyframes wk-maple\{0%\{transform:rotate\(-8deg\)/);
  assert.match(key, /50%\{transform:rotate\(11deg\)/, "要来回晃，不能只往一边转");
  assert.match(key, /animation: "wk-maple/, "晃只在生成中那一档");
});

test("群线上那两档：实线／虚线，不是只换个颜色", () => {
  assert.match(key, /dash: hold === true/);
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
