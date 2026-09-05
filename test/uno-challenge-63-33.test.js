// v63.33 小游戏审计批 10：UNO 质疑 +4 的界面接线。
// 规则本体在 uno-core（test/uno-core.test.js 里是真跑的行为测试：诈打记档、
// 质疑成功罚出牌人 4 且质疑者原地出牌、质疑失败罚 6）。这里钉的是 games.js 那半：
// 你被 +4 有「质疑」键；AI 被 +4 不再闷头照单全收，由本人（模型/CC 同一条路）决定。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const src = fs.readFileSync(path.join(__dirname, "..", "js", "games.js"), "utf8");
const cut = (s, a, b) => { const i = s.indexOf(a); assert.ok(i >= 0, "锚没了：" + a.slice(0, 40)); return s.slice(i, s.indexOf(b, i + a.length)); };

test("你被 +4 时有质疑键，且只在顶上真是带记档的 +4 时亮", () => {
  assert.match(src, /\(state\.pendingDraw && state\.w4 && top && top\.value === "W4"\) \? h\("button"/, "质疑键的门不对");
  assert.match(src, /userAct\(\{ kind: "challenge" \}\)/, "质疑键没接 challenge 动作");
});

test("AI 被 +4：本人决定接受还是质疑，言秋走同一条 routeSeatCall", () => {
  const seg = cut(src, 'if (state.w4 && top && top.value === "W4") {', "setTimeout(function () { try { const n = clone(); UnoCore.act(n, { kind: \"draw\" });");
  assert.match(seg, /routeSeatCall\(current, api, sysC/, "AI 的质疑决定没走本人那条路（言秋会被代决）");
  assert.match(seg, /a\.kind === "challenge" \? "challenge" : "draw"/, "决定没落成动作，或者默认不是接受");
  assert.match(seg, /你看不到 TA 的手牌/, "没告诉本人这是赌，模型会当成开卷考试");
  // 出牌提示也说清了诈打的代价
  assert.match(src, /你也可以冒险诈打，但被下家质疑抓到要替 TA 罚 4/, "出牌提示没讲诈打的代价");
});
