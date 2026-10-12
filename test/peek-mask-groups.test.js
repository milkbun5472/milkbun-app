const test = require("node:test"); const assert = require("node:assert");
const src = require("fs").readFileSync(__dirname + "/../js/app.js", "utf8");
const a = src.indexOf("const peekMaskOthers ="), body = src.slice(a, src.indexOf("\n  };", a) + 4);
test("查手机：群里有别的面具的人，这个群整个不给看", () => {
  const f = new Function("characters", "groupsRef", "maskKeyOf", body + "; return peekMaskOthers;");
  const chars = [{ id: "a" }, { id: "b" }, { id: "x" }];
  const groups = { current: [{ id: "g1", memberIds: ["a", "b"] }, { id: "g2", memberIds: ["a", "x"] }] };
  const mk = id => id === "x" ? "m2" : "";
  assert.deepEqual(f(chars, groups, mk)("a"), ["x", "g2"]);
  assert.deepEqual(f(chars, groups, mk)("x").sort(), ["a", "b", "g1", "g2"]);
});
