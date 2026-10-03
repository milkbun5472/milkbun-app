// 她 2026-10-02 转群友：建卡时人设里写明的关系和过往也算真实发生过的事
const test = require("node:test");
const assert = require("node:assert");
const g = require("fs").readFileSync(require("path").join(__dirname, "..", "js/gaze.js"), "utf8");
test("建卡认人设里写明的关系", () => {
  assert.match(g, /人设里写明的你们之间的关系和过往.*也是真实发生过的事,照着写/);
});
