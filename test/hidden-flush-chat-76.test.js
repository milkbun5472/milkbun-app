const test = require("node:test"); const assert = require("node:assert");
const src = require("fs").readFileSync(__dirname + "/../js/app.js", "utf8");
test("后台时聊天落盘不等渲染：单聊、群聊都走 hiddenFlush", () => {
  const i = src.indexOf("const hiddenFlush"); assert.ok(i > 0);
  assert.match(src.slice(i, i + 400), /flushSync\(run\)/);
  assert.match(src, /const pChat = \(id, u\) => \{[\s\S]{0,200}hiddenFlush\(run\)/);
  assert.match(src, /const pGChat = \(id, u\) => \{[^\n]*hiddenFlush\(run\)/);
  assert.match(src, /const pChatNext = \(p, id, u\)/); assert.match(src, /const pGChatNext = \(p, id, u\)/);
});
