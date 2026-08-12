const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");

const app = fs.readFileSync(require.resolve("../js/app.js"), "utf8");

test("普通私聊只为空正文静默补试一次，不吞隐藏思考", () => {
  assert.match(app, /if \(_engineerChat \|\| !\/模型返回为空\/\.test/);
  assert.match(app, /【空正文重试】/);
  assert.match(app, /不要输出分析过程/);
  assert.doesNotMatch(app, /reasoning_content/);
});

test("言秋 Max 订阅线不在空正文后暗中二次扣额度", () => {
  assert.match(app, /Max 订阅按实际调用吃额度/);
  assert.match(app, /if \(_engineerChat \|\| !\/模型返回为空\/\.test/);
});

test("两次仍失败时显示系统行，不冒充角色气泡", () => {
  assert.match(app, /kind: "system",\n\s*content: "（发送失败："/);
});
