const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.join(__dirname, "..");
const app = fs.readFileSync(path.join(root, "js/app.js"), "utf8");
const comp = fs.readFileSync(path.join(root, "js/components.js"), "utf8");
const scr = fs.readFileSync(path.join(root, "js/screens.js"), "utf8");

// 她 2026-09-02：「这个格式不对。而且本来买东西也不应该调用啊。
//                 应该做成系统通知放聊天里然后等我按回复他才反应」。
const pay = app.slice(app.indexOf("const payWithKinship ="), app.indexOf("const receiveUse ="));

test("刷卡不调模型", () => {
  assert.ok(!/genKinshipComment/.test(app), "买个东西不该现调一次模型——她按次计费");
  assert.ok(!/callAI/.test(pay), "payWithKinship 里不许有任何一次调用");
});

test("刷卡通知不许再走 kind:\"system\"——那一类压根不进模型历史", () => {
  assert.match(pay, /kind: "kinbill"/, "得有一条落进聊天");
  assert.ok(!/kind: "system"/.test(pay), "v60.44 就是写成 system 的，他一个字都读不到");
  // history 那道过滤器：kind==="system" 除 ccToolResult 外一律不进模型
  const filt = app.slice(app.indexOf("const history = base.filter"));
  assert.match(filt.slice(0, 220), /m\.kind !== "system" \|\| m\.ccToolResult === true/,
    "这道过滤器就是 v60.44 那条通知没人看见的原因，别改坏了");
  assert.ok(!/kinbill/.test(filt.slice(0, 220)), "kinbill 不该被这道过滤器挡掉");
});

test("他下一轮读得懂这条，而且不当成她说的一句话", () => {
  const ser = app.slice(app.indexOf("for (const m of promptHistory) {"));
  const line = ser.slice(ser.indexOf('m.kind === "kinbill"'), ser.indexOf('m.kind === "kinbill"') + 400);
  assert.ok(line.includes("不是 Ta 跟你说的一句话，是 Ta 做的一件事"),
    "不挑明的话他会把这条当成她发的消息去回");
  assert.ok(/也完全可以不提/.test(line),
    "不许写成「必须回应」——他要不要提，看人设和心情");
  assert.ok(/从你账上扣了/.test(line), "得说清扣的是他的钱");
});

test("这条不冒未读红点：是她自己按的，不是他来消息", () => {
  assert.match(pay, /role: "user"/, "记在她名下");
  assert.match(pay, /read: true/);
  const bump = app.slice(app.indexOf("const added = n.slice(pl.length)"));
  assert.match(bump.slice(0, 140), /m\.role === "assistant"/, "未读只数角色消息");
});

test("聊天里那条长成一张刷卡通知，不是居中红斜体的 SYSTEM RESPONSE", () => {
  assert.match(comp, /if \(m\.kind === "kinbill"\) return h\(KinshipSpendCard/);
  const card = comp.slice(comp.indexOf("function KinshipSpendCard"), comp.indexOf("function PayLaterCard"));
  assert.ok(!/fontStyle: "italic"/.test(card) && !/SYSTEM RESPONSE/.test(card),
    "v60.44 那个形状就是它，她说格式不对");
  // 刷卡短信该说清的四件事：谁的卡、买了什么、多少钱、还剩多少
  assert.match(card, /Avatar/, "看不出是谁的卡");
  assert.match(card, /m\.item/);
  assert.match(card, /m\.amount/);
  assert.match(card, /m\.remain/);
});

test("账单页那条「角色评论」跟着删掉，不留半截", () => {
  const bill = scr.slice(scr.indexOf("function KinshipBill("), scr.indexOf("// US (couple)"));
  assert.ok(!/l\.comment/.test(bill), "没有任何东西会填它了——撤掉东西要删除");
  assert.ok(!/comment: ""/.test(pay), "ledger 里那个空字段也一起删");
});
