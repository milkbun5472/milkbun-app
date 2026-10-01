// 她 2026-10-02「群聊重roll是还有以前的记录…不应该有」：重 Roll 整轮退回
const test = require("node:test");
const assert = require("node:assert");
const app = require("fs").readFileSync(require("path").join(__dirname, "..", "js/app.js"), "utf8");
const i = app.indexOf("  const groupRoundStart = "), j = app.indexOf("  const handleGroupMsgAction = ", i);
const groupRoundStart = new Function(app.slice(i, j).replace("const groupRoundStart =", "return"))();
test("一轮共用轮次戳", () => {
  assert.match(app, /const gTurnId = "gt_" \+ gRoundTs \+ "_" \+ i;/);
  assert.match(app, /start = groupRoundStart\(msgs, start\);/);
});
test("点最后一位，整轮都退；上一轮和用户那句不动", () => {
  const m = [{ role: "user" }, { role: "assistant", turnId: "gt_100_0" }, { role: "assistant", turnId: "gt_200_0" }, { role: "assistant", turnId: "gt_200_1" }, { role: "assistant", turnId: "gt_200_3" }];
  assert.strictEqual(groupRoundStart(m, 4), 2);
  const u = [{ role: "assistant", turnId: "gt_100_2" }, { role: "user" }, { role: "assistant", turnId: "gt_300_0" }];
  assert.strictEqual(groupRoundStart(u, 2), 2);
});
test("旧消息：各自时间戳，序号递增且挨得近就算同一轮", () => {
  const m = [{ role: "assistant", turnId: "gt_1000_4" }, { role: "assistant", turnId: "gt_5000_0" }, { role: "assistant", turnId: "gt_5300_1" }];
  assert.strictEqual(groupRoundStart(m, 2), 1);
});
