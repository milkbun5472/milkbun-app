// 2026-11-26 群友：更新日志上次看到 11-24，这次只到 11-23——缺块的旧 index 被后台补齐以后又拿来开门
const test = require("node:test"), assert = require("node:assert/strict"), fs = require("fs");
const sw = fs.readFileSync(__dirname + "/../sw.js", "utf8");
test("用新版开了门以后，缺块的旧 index 当场丢掉，不会被补齐后再拿来开门", () => {
  const i = sw.indexOf("async function serveShell("), j = sw.indexOf("self.addEventListener(\"message\"", i);
  assert.ok(i > 0 && j > i, "抠不出 serveShell");
  const seg = sw.slice(i, j), k = seg.indexOf("if (!miss.length || !cached)");
  assert.ok(k > 0);
  const tail = seg.slice(k, seg.indexOf("return new Response(html", k));
  assert.match(tail, /cache\.delete\("__index__"\)/);
  assert.ok(tail.indexOf('cache.delete("__index__")') < tail.indexOf("installShell("), "要先丢旧的再在后台补块");
});
