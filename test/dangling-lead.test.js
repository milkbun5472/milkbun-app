// 「第一：」挂在上一泡尾巴上的挪到下一泡开头（她 2026-11-01「这糟糕的切泡」）
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs"), vm = require("vm"), path = require("path");
const ctx = { console, window: { addEventListener() {} }, navigator: { userAgent: "" }, document: { addEventListener() {} } };
vm.createContext(ctx);
try { vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "js", "engine.js"), "utf8"), ctx); } catch (e) {}
const f = vm.runInContext("moveDanglingLeads", ctx);
const J = x => JSON.stringify(x);
test("列点的起头词挪到下一泡", () => {
  assert.equal(J(f(["那我的诉求可太明确了，第一：", "严正拒绝任何道具，第二：", "如果非要落实"])), J(["那我的诉求可太明确了", "第一：严正拒绝任何道具", "第二：如果非要落实"]));
  assert.equal(J(f(["说三件事 首先", "我饿了"])), J(["说三件事", "首先，我饿了"]));
});
test("不是在列点的不动", () => {
  assert.equal(J(f(["这是第一", "好的"])), J(["这是第一", "好的"]));
  assert.equal(J(f(["我们第一次见面", "嗯"])), J(["我们第一次见面", "嗯"]));
  assert.equal(J(f(["最后一句，第一："])), J(["最后一句，第一："]));   // 后面没泡了就不挪
});
test("单聊群聊都接上", () => {
  const app = fs.readFileSync(path.join(__dirname, "..", "js", "app.js"), "utf8");
  assert.match(app, /words = moveDanglingLeads\(words\);/);
  assert.match(app, /gBubbles = moveDanglingLeads\(gBubbles\);/);
});
