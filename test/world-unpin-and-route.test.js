// 她 2026-10-02 群友报：开图时带进来的人「挪走」后又被行程拽回来；手动钉的人可以选择补一张「会去哪儿」
const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs"), path = require("path");
const map = fs.readFileSync(path.join(__dirname, "..", "js/map.js"), "utf8");
const app = fs.readFileSync(path.join(__dirname, "..", "js/app.js"), "utf8");
test("没钉在这个世界的人不画在图上", () => {
  const i = map.indexOf("function liveNodeOf(");
  const seg = map.slice(i, i + 600);
  assert.ok(seg.indexOf('if (!pinned) return { node: "", live: false };') > 0);
  assert.ok(seg.indexOf("if (!pinned)") < seg.indexOf("if (!st)"), "要先看钉子");
});
test("小表只有一处解析，开世界和补表共用", () => {
  assert.equal((app.match(/const worldRouteFrom = /g) || []).length, 1);
  assert.ok((app.match(/worldRouteFrom\(/g) || []).length >= 2);
  assert.ok(app.indexOf("const worldRouteFrom = ") < app.indexOf("const genWorld = "), "TDZ");
});
test("补表按钮一路接到 app", () => {
  assert.match(app, /onRouteWorld: routeWorld,/);
  assert.match(map, /onRoute: function \(charId\) \{ onRoute\(cur\.id, charId\); \}/);
  assert.match(map, /!\(world\.route \|\| \{\}\)\[c\.id\] && onRoute/);
});
