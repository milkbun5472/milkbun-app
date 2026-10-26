const test = require("node:test"); const assert = require("node:assert/strict"); const fs = require("fs");
const app = fs.readFileSync(__dirname + "/../js/app.js", "utf8");
test("查手机微信：他自己的配角没连关系线也算熟人（群友 2026-10-26）", () => {
  const i = app.indexOf("const relatedNames = char =>");
  const src = app.slice(i, app.indexOf("return [...set];", i) + 20);
  const fn = new Function("characters", "rels", src + ";return relatedNames;");
  const cs = [{ id: "a", name: "陆" }, { id: "n", name: "小周", npc: true, ownerId: "a" }, { id: "b", name: "沈" }, { id: "m", name: "别人的", npc: true, ownerId: "b" }];
  const got = fn(cs, { "a->b": {} })(cs[0]);
  assert.deepEqual(got, ["小周", "沈"]);
});
