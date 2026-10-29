const test = require("node:test"); const assert = require("node:assert"); const fs = require("fs");
const src = fs.readFileSync(__dirname + "/../js/app.js", "utf8");
test("单人线下正演着，主动消息的各条岔路都不从线上发", () => {
  assert.match(src, /if \(opts\.proactive && !opts\.room && offlineTogetherNow\(charId\)\) return null;/);
  const i = src.indexOf("const offlineTogetherSess = charId =>");
  assert.ok(src.slice(i, i + 400).includes('loadJSON("x_offline:" + charId'), "没缓存时也要读存档");
});
