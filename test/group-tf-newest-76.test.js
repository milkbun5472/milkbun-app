// 群转账：表态结算最新那一笔，跟单聊一样（2026-10-31）
const test = require("node:test"), assert = require("node:assert");
const s = require("fs").readFileSync(require("path").join(__dirname, "..", "js", "app.js"), "utf8");
test("取最新那笔，不是最早那笔", () => {
  assert.match(s, /const _mine = gPendingTf\.filter\(x => x\.toId === spk\.id && x\.status === "pending"\)\.pop\(\);/);
  assert.match(s, /表态管的是【最新那一笔】/);
});
