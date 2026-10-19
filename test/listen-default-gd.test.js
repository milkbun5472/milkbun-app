// 她 2026-10-19：一起听默认音乐源改 GD，没动过的人直接是 GD；挑过网易云或填了接口的不动。
const test = require("node:test");
const assert = require("node:assert/strict");
const app = require("fs").readFileSync(require("path").join(__dirname, "../js/app.js"), "utf8");
test("默认 GD，自己挑过网易云/填过接口的照旧", () => {
  const m = app.match(/const musicProvider = ([^;]+);/);
  assert.ok(m);
  const pick = new Function("listen", "neteaseApi", "return " + m[1] + ";");
  assert.equal(pick({}, ""), "gd");
  assert.equal(pick({ musicProvider: "gd" }, "x"), "gd");
  assert.equal(pick({ musicProvider: "netease" }, ""), "netease");
  assert.equal(pick({}, "https://api.x"), "netease");
});
