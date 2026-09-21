// 她 2026-09-19：「亲属卡能不能做一个解绑功能然后解绑的时候可以落一张通知卡到聊天
//   然后我回到聊天说完话让他回复他就知道我解绑了然后做出反应」
//
// 形状照刷卡单、提额单来：那两件事已经立过规矩——【她做的一件事】落进聊天、
// 等下一轮喂给模型，而不是弹一个系统通知然后什么都不留。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const P = f => fs.readFileSync(path.join(__dirname, "..", f), "utf8");
const app = P("js/app.js"), screens = P("js/screens.js"), comps = P("js/components.js");

const unbind = () => {
  const i = app.indexOf("  const unbindKinship = (charId, reason) => {");
  assert.ok(i > 0, "抠不出 unbindKinship");
  const j = app.indexOf("\n  };", i);
  return app.slice(i, j);
};

test("退卡真的把卡销掉，而且先问一句", () => {
  const seg = unbind();
  assert.ok(seg.includes("requestAppConfirm"), "不问就退了——流水跟着卡一起没");
  assert.ok(/saveKinship\(p => p\.filter\(c => c\.charId !== charId\)\)/.test(seg), "卡没销掉");
  // ⚠️落盘走 saveKinship 这一处：它自己会同步 ref + 写 localStorage
  assert.ok(!/setKinshipCards\(/.test(seg), "绕过 saveKinship 直接改 state——ref 和存档会对不上");
  assert.ok(/已经扣掉的钱不退回/.test(seg), "没说清已经花掉的钱不会回去");
});

test("退卡落一张通知卡进聊天，是她做的事不是系统说话", () => {
  const seg = unbind();
  assert.ok(/pChat\(charId, p => \[\.\.\.p, \{ role: "user", kind: "kinunbind"/.test(seg),
    "没落进聊天，或者写成了 assistant/系统消息");
  assert.ok(/limit: card\.limit \|\| 0/.test(seg) && /used: used/.test(seg), "卡上的额度和已刷金额没留下");
  assert.ok(/reason: why/.test(seg), "她留的那句话没带上");
  assert.ok(/turnId:/.test(seg), "没有 turnId");
});

// ⚠️她要的就是这一步：「我回到聊天说完话让他回复他就知道我解绑了」——
//   靠的是历史翻译那一处认得 kinunbind，不是靠退卡当场调模型。
test("下一轮喂给模型时认得这件事", () => {
  const i = app.indexOf('m.kind === "kinunbind"');
  assert.ok(i > 0, "喂给模型的那一处不认识 kinunbind——TA 永远不会知道她退了卡");
  const seg = app.slice(i, i + 900);
  assert.ok(/moneyText\(m\.limit \|\| 0, charId\)/.test(seg), "没告诉 TA 当时额度是多少");
  assert.ok(/m\.reason/.test(seg), "她留的那句话没喂进去");
  // ⚠️掷约束、别掷答案（bans-make-it-dumber）：给出口，不给判决
  assert.ok(/不是 Ta 跟你说的一句话，是 Ta 做的一件事/.test(seg), "没说清这是动作不是台词——TA 会当成她在讲话");
  assert.ok(/全看你的人设/.test(seg), "把反应替 TA 定死了");
  assert.ok(/完全可以什么都不说/.test(seg), "没给「不提」这个出口——会变成每轮必提");
});

test("聊天里画得出这张卡", () => {
  assert.ok(comps.includes('if (m.kind === "kinunbind") return h(KinshipUnbindCard'), "渲染没接上");
  assert.ok(comps.includes("function KinshipUnbindCard({ m, character }) {"), "卡没写");
  const i = comps.indexOf("function KinshipUnbindCard({ m, character }) {");
  const seg = comps.slice(i, i + 2200);
  assert.ok(/justify-end/.test(seg), "没摆在她那一侧——这是她按的一个键");
  assert.ok(/repeating-linear-gradient/.test(seg), "那一道颜色没断开，跟还能刷的卡看着一样");
  assert.ok(/mTight\(m\.used \|\| 0/.test(seg), "没写共刷过多少");
});

test("入口在账单页，而且不跟「申请加额度」并排", () => {
  const i = screens.indexOf("function KinshipBill({"), j = screens.indexOf("\n// =====", i);
  assert.ok(i > 0 && j > i, "抠不出 KinshipBill");
  const seg = screens.slice(i, j);
  assert.ok(/onUnbind\(why\)/.test(seg), "退卡那颗没接上");
  assert.ok(seg.indexOf("申请加额度") < seg.indexOf("把这张卡退回去"), "退卡摆到了提额前面/旁边——方向相反的两件事并排迟早点错");
  assert.ok(/maxLength: 60/.test(seg), "留言没封长度");
  assert.ok(app.includes("onUnbind: why => unbindKinship(activeCardId, why)"), "app 那头没把 onUnbind 传下去");
});
