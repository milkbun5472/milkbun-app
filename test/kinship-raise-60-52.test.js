const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..");
const app = fs.readFileSync(path.join(root, "js/app.js"), "utf8");
const comp = fs.readFileSync(path.join(root, "js/components.js"), "utf8");
const raise = app.slice(app.indexOf("const requestKinshipRaise"), app.indexOf("// 随身物品 Carry"));
const card = comp.slice(comp.indexOf("function KinshipRaiseCard"), comp.indexOf("// 代付请求卡"));

// 她 2026-09-02：「这个申请额度通知略敷衍」。
// 原来是一句加了括号的粉气泡「（在亲属卡上向 顾暮 申请把额度加 ¥3000）」。

test("不再是一句加括号的话，而是一张申请单", () => {
  assert.ok(!/（在亲属卡上向 " \+ char\.name/.test(raise), "那句括号话还在");
  assert.match(raise, /kind: "kinraise"/);
  assert.match(comp, /if \(m\.kind === "kinraise"\) return h\(KinshipRaiseCard/);
  // 该说清的四件事：谁的卡、现在多少、想加多少、批没批
  assert.match(card, /Avatar/);
  assert.match(card, /"现在 ¥" \+ \(m\.limit \|\| 0\)/);
  assert.match(card, /m\.ask/);
  assert.match(card, /m\.status \|\| "pending"/);
});

test("结果要盖回【同一张】单子上，不是只闪一下 toast", () => {
  // 这是她说「敷衍」的另一半：他加没加、加了多少，回头看聊天一个字都看不见
  assert.match(raise, /const rid = "kr_" \+ Date\.now\(\);/);
  assert.match(raise, /x\.kind === "kinraise" && x\.rid === rid \? \{ \.\.\.x, \.\.\.patch \}/);
  assert.match(raise, /stamp\(add > 0 \? \{ status: "approved", add: add, newLimit: newLimit \} : \{ status: "declined" \}\)/);
});

test("调用失败也要落个状态，不许永远挂着「等他回话」", () => {
  assert.match(raise, /catch \(e\) \{ stamp\(\{ status: "failed" \}\); toast\("加额度失败：/);
  assert.match(card, /st === "failed" \? "没送出去，回头再试"/);
});

test("四种状态各说各的话，不是只换个颜色", () => {
  ["approved", "declined", "failed", "pending"].forEach(k =>
    assert.ok(card.indexOf(k) > 0, "少了状态：" + k));
  assert.match(card, /"已加 ¥" \+ \(m\.add \|\| 0\) \+ " · 现在额度 ¥" \+ \(m\.newLimit \|\| 0\)/,
    "批了要说清加了多少、现在多少");
  // 色弱和阳光下只剩形状/文字可依：不许只靠 fc 那个色差区分
  assert.match(card, /const foot = /);
});

test("没说数目那一档也要读得通", () => {
  assert.match(raise, /ask: ask/);
  assert.match(card, /"你看着加"/, "留空是允许的（卡页面上就写着「可留空让 TA 看着给」）");
});

test("他下一轮读得懂这张单子，也知道自己批了没有", () => {
  const ser = app.slice(app.indexOf("for (const m of promptHistory) {"));
  const i = ser.indexOf('m.kind === "kinraise"');
  const line = ser.slice(i, i + 520);
  assert.ok(i > 0, "序列化里没这一支");
  assert.ok(line.includes("这是 Ta 按的一个申请，不是 Ta 说的一句话"));
  assert.ok(line.includes("你加了 ¥") && line.includes("你没有加"), "结果也要带给他");
  assert.ok(line.includes("让你看着办"), "没说数目那一档");
});

test("这是她按的键，不冒未读红点", () => {
  assert.match(raise, /role: "user", kind: "kinraise", rid: rid, read: true/);
  const bump = app.slice(app.indexOf("const added = n.slice(pl.length)"));
  assert.match(bump.slice(0, 140), /m\.role === "assistant"/);
});
