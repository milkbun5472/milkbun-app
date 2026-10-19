// 群友 2026-10-19：一起听歌单改不了名——改名键还在，里面是空的，看不见点不着。
const test = require("node:test");
const assert = require("node:assert/strict");
const ui = require("fs").readFileSync(require("path").join(__dirname, "../js/screens-ui.js"), "utf8");
test("歌单详情顶上的改名键有字", () => {
  const i = ui.indexOf('requestAppPrompt("歌单改名"');
  assert.ok(i > 0);
  assert.match(ui.slice(i, i + 400), /\}, "改名"\)/);
});
