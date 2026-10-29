const test = require("node:test"); const assert = require("node:assert"); const fs = require("fs");
const root = __dirname + "/../";
const app = fs.readFileSync(root + "js/app.js", "utf8"), comp = fs.readFileSync(root + "js/components.js", "utf8");
const src = fs.readFileSync(root + "js/ask-slip.js", "utf8");
const AskSlip = new Function(src.split("if (typeof window")[0] + "; return AskSlip;")();

test("请示那一行：没批只说事；批了带上谁批、批了什么", () => {
  assert.equal(AskSlip.line({ what: "买相机", amount: 3999, reason: "想拍你" }, "我"), "[请示] 我：买相机（3999 块）；理由：想拍你");
  assert.match(AskSlip.line({ what: "请假", status: "rejected", judge: "阿秋", note: "不准" }), /阿秋 批：驳（不准）$/);
  assert.match(AskSlip.line({ what: "买", amount: 5, status: "paid" }), /批：我出$/);
});

test("群里过半才准，一样多算驳", () => {
  const p = (y, n) => ({ options: [{ voters: y }, { voters: n }] });
  assert.equal(AskSlip.tally(p(["a", "b"], ["c"])).status, "approved");
  assert.equal(AskSlip.tally(p(["a"], ["c"])).status, "rejected");
  assert.equal(AskSlip.amountOf("-12.345"), 12.35);
  assert.equal(AskSlip.amountOf(""), 0);
});

test("单聊群里都接上：递、批、TA自己递；钱只在结案那一处动", () => {
  ["const sendAsk = (", "const settleAsk = (", "const startAsk = (", "const postAsk = (", "const settleGroupAsk = ("].forEach(k => assert.ok(app.includes(k), k));
  assert.match(app, /openCaps\.push\("askVerdict"\)/);
  assert.match(app, /openCaps\.push\("askNew"\)/);
  assert.match(app, /item\.askNew && typeof item\.askNew === "object" && spk/);
  assert.match(app, /onStartAsk: a => startAsk\(activeGroup\.id, a\)/);
  const seg = app.slice(app.indexOf("const settleGroupAsk = ("), app.indexOf("// 成员自己发起的投票"));
  assert.match(seg, /groupClosed\(groupId\)/, "闭群是过家家，不动钱");
  assert.ok(comp.includes('["ask", "请示", "checklist"]'));
});
