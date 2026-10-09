const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");

const app = fs.readFileSync(require.resolve("../js/app.js"), "utf8");

test("私聊空正文不再静默补打第二枪，不吞隐藏思考", () => {
  assert.doesNotMatch(app, /【空正文重试】/, "失败了不许再试第二次（她 2026-10-09）");
  assert.doesNotMatch(app, /reasoning_content/);
});

test("两次仍失败时显示系统行，不冒充角色气泡", () => {
  // v68.18：这条行长什么样搬进了公共的 ChatContextFilter.failureNotice（群聊那条
  // 原来是另一个形状，掉进了普通气泡），这儿只钉「走的是那一份」和文案。
  assert.match(app, /window\.ChatContextFilter\.failureNotice\(\s*\n?\s*"（发送失败："/);
  const F = require("../js/chat-context-filter.js");
  const row = F.failureNotice("（发送失败：x）");
  assert.equal(row.kind, "system");
  assert.equal(row.contextExcluded, true);
  assert.equal(row.systemFailure, true);
});
