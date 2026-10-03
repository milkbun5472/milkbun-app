const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const app = fs.readFileSync(__dirname + "/../js/app.js", "utf8");
const map = fs.readFileSync(__dirname + "/../js/map.js", "utf8");
const src = app.slice(app.indexOf("  const delWorldNode = "), app.indexOf("  const genWorldNodes = "));
function run(worlds, wid, nm) {
  let saved = null, msg = "";
  const f = new Function("worldsRef", "worlds", "saveWorlds", "toast", src + "; return delWorldNode;")({ current: worlds }, worlds, w => { saved = w; }, m => { msg = m; });
  return { ok: f(wid, nm), saved, msg };
}
const W = () => [{ id: "w", pins: { a: "酒馆", b: "码头" }, regions: [
  { name: "东区", adj: ["港口"], nodes: [{ name: "酒馆" }, { name: "市集" }] },
  { name: "港口", adj: ["东区"], nodes: [{ name: "码头" }] }] }];
test("delete a place: removed, pins on it dropped", () => {
  const r = run(W(), "w", "酒馆");
  assert.ok(r.ok);
  assert.deepEqual(r.saved[0].regions[0].nodes.map(n => n.name), ["市集"]);
  assert.deepEqual(r.saved[0].pins, { b: "码头" });
});
test("emptied region goes away with its adjacency", () => {
  const r = run(W(), "w", "码头");
  assert.deepEqual(r.saved[0].regions.map(x => x.name), ["东区"]);
  assert.deepEqual(r.saved[0].regions[0].adj, []);
});
test("last place cannot be deleted", () => {
  const r = run([{ id: "w", regions: [{ name: "a", nodes: [{ name: "x" }] }] }], "w", "x");
  assert.equal(r.ok, false); assert.equal(r.saved, null);
});
test("all three map entries wire onDelNode, with a confirm step", () => {
  assert.match(map, /delAsk \? "确定删掉？" : "删除"/);
  assert.match(map, /onDelNode: o\.onDelNode \?/);
  assert.match(map, /onDelNode: onDelNode \? function \(nm\) \{ return onDelNode\(cur\.id, nm\); \}/);
  assert.match(app, /onDelNode: delWorldNode/);
});
