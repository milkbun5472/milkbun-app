const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const qq = fs.readFileSync(__dirname + "/../js/assistant.js", "utf8");
test("秋秋聊天：我自己的气泡也能复制，两侧挂点用 data-me 分开", () => {
  assert.match(qq, /"data-wk": "qqcopy", "data-me": "1", onClick: async \(\) => \{ const ok = typeof copyText === "function" && await copyText\(m\.text\)/);
  assert.match(qq, /"data-wk": "qqcopy", "data-me": "0", onClick:/);
});
