// 饭点来问轮着来（群友 2026-10-14）：不再永远是名单第一个
const test = require("node:test");
const assert = require("node:assert");
const app = require("fs").readFileSync(require("path").join(__dirname, "../js/app.js"), "utf8");
test("按哪天哪一顿轮转挑人", () => {
  assert.match(app, /const _seed = String\(hn\.day\) \+ ":" \+ String\(hn\.meal\);/);
  assert.match(app, /const cand = _ok\.length \? _ok\[_h % _ok\.length\] : null;/);
  assert.ok(!/const cand = characters\.find\(c => hn\.ids\.includes/.test(app));
});
