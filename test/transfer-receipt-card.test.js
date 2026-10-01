const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const app = fs.readFileSync(__dirname + "/../js/app.js", "utf8");
const comp = fs.readFileSync(__dirname + "/../js/components.js", "utf8");
test("收下/退回转账：原 system 行挂 receipt，界面画成回执卡（单聊、群聊都接）", () => {
  assert.ok(app.includes('receipt: { side: card.dir === "toChar" ? "char" : "me"'));
  assert.ok(app.includes('receipt: { side: "char", senderId: card.toId'));
  assert.strictEqual((comp.match(/if \(m\.receipt && m\.receipt\.amount != null\) return h\(TransferCard/g) || []).length, 2);
  // 回执卡必须排在通用 system 灰字之前，不然会被吞成一行字
  const a = comp.indexOf("if (m.receipt && m.receipt.amount != null)");
  assert.ok(a > 0 && a < comp.indexOf('if (m.kind === "system" || m.role === "system") return h(SysNote', a - 1) + 1);
  assert.ok(comp.includes('m.receiptCard ? (m.status === "accepted" ? "收款" : "退还") : "转账"'));
});
