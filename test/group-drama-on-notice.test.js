// 她 2026-10-02：打开修罗场那一刻，在群里落一条灰提示，「发现」成了记录里刚发生的事
const test = require("node:test");
const assert = require("node:assert");
const app = require("fs").readFileSync(require("path").join(__dirname, "..", "js/app.js"), "utf8");
test("打开（从关到开）才落一条，进群聊上下文时说成刚发生的事", () => {
  assert.match(app, /if \(patch && patch\.drama === true && !gsFor\(id\)\.drama\) pGChat\(id,/);
  assert.match(app, /dramaOn: true/);
  assert.match(app, /const groupHistLine = m => m\.dramaOn\n\s*\? "【就在这个位置，刚发生/);
});
