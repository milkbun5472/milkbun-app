const test = require("node:test"); const assert = require("node:assert");
const fs = require("fs");
const app = fs.readFileSync(__dirname + "/../js/app.js", "utf8");
const eng = fs.readFileSync(__dirname + "/../js/engine.js", "utf8");
const cmp = fs.readFileSync(__dirname + "/../js/components.js", "utf8");
const cut = (src, name) => { const a = src.indexOf("const " + name + " ="); return src.slice(a, src.indexOf("\n  };", a) + 4); };
test("群挑面具：没挑过且全员同一张副面具就默认那张；挑了就照挑的", () => {
  const body = cut(app, "groupMaskKey");
  const mk = (gsMap, memberMasks, masks) => new Function("gsFor", "groupsRef", "groups", "maskKeyOf", "maskPrimary", "masksRef",
    body + "; return groupMaskKey;")(id => gsMap[id] || {}, { current: [{ id: "g", memberIds: Object.keys(memberMasks) }] }, [], id => memberMasks[id] || "", "", { current: masks });
  assert.equal(mk({}, { a: "m2", b: "m2" }, [{ id: "m2" }])("g"), "m2");
  assert.equal(mk({}, { a: "m2", b: "" }, [{ id: "m2" }])("g"), "");
  assert.equal(mk({ g: { maskId: "" } }, { a: "m2", b: "m2" }, [{ id: "m2" }])("g"), "");
  assert.equal(mk({ g: { maskId: "m3" } }, { a: "" }, [{ id: "m3" }])("g"), "m3");
  assert.equal(mk({ g: { maskId: "gone" } }, { a: "" }, [])("g"), "");
});
test("群的提示词、钟、界面都接上群那张面具", () => {
  assert.match(app, /vclockUse\("g:" \+ groupId\);[^\n]*\n    const profile = groupProfileFor\(groupId\);/);
  assert.match(app, /if \(String\(id \|\| ""\)\.indexOf\("g:"\) === 0\) return groupMaskKey/);
  assert.match(app, /profile: groupProfileFor\(group\.id\),\n    clockId: "g:" \+ group\.id,\n    maskNote: groupMaskNote\(group\.id\),/);
  assert.match(eng, /vclockUse\(ctx\.clockId != null \? ctx\.clockId : null\)/);
  assert.match(app, /profile: groupProfileFor\(activeGroup\.id\),/);
  assert.match(cmp, /"data-wk": "gmaskpick"/);
  assert.match(cmp, /maskId: gMask, layout: gLayout/);
  assert.doesNotMatch(app + eng, /vclockUse\(null\)/);
});
