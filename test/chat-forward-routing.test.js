const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const app = fs.readFileSync(path.join(__dirname, "..", "js", "app.js"), "utf8");
const components = fs.readFileSync(path.join(__dirname, "..", "js", "components.js"), "utf8");

test("private and group threads both offer chat and group forwarding targets", () => {
  // 2026-11-04 起单聊、群聊共用 ForwardPickSheet，人和群都能勾，一次发给好几个
  assert.match(components, /row\(\{ type: "chat", id: c\.id \}/);
  assert.match(components, /row\(\{ type: "group", id: g\.id \}/);
  assert.equal((components.match(/h\(ForwardPickSheet, \{/g) || []).length, 2);
  assert.match(components, /function GroupThread\([\s\S]*onForward/);
});

test("forwarded records retain readable prompt content and structured provenance", () => {
  assert.match(app, /kind: "chatforward"/);
  assert.match(app, /【转发的聊天记录】/);
  assert.match(app, /【转发的群聊记录 · /);
  assert.match(app, /sourceType: "chat"/);
  assert.match(app, /sourceType: "group"/);
  assert.match(app, /pGChat\(g\.id/);
  assert.match(app, /pChat\(toChar\.id/);
});
