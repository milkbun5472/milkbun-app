const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const comp = fs.readFileSync(path.join(__dirname, "..", "js", "components.js"), "utf8");
const ts = fs.readFileSync(path.join(__dirname, "..", "js", "theme-studio.js"), "utf8");
// 她 2026-10-07：「美化 quote 的只在实际屏幕上显示，聊天框还没发出去那里的 quote 没有同步」
test("待发送的引用用同一套 quote 挂点，单聊群聊共用一份", () => {
  const i = comp.indexOf("function QuoteDraftBar("), j = comp.indexOf("\n}\n", i);
  assert.ok(i > 0 && j > i);
  const seg = comp.slice(i, j);
  assert.match(seg, /"data-wk": "quote", "data-me": "1", "data-draft": "1"/);
  assert.match(seg, /"data-wk": "quoteicon"/);
  assert.match(seg, /"data-wk": "quotetext"/);
  assert.equal((comp.match(/h\(QuoteDraftBar, \{/g) || []).length, 2, "单聊、群聊都要用它");
  ["quotedraft", "quoteclear"].forEach(k => assert.ok(ts.includes('["' + k + '"'), "名单里没有 " + k));
});
