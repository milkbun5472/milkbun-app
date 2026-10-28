// 群里 2026-10-28：推演出来的群里「智旻」「泰亨」是色块，角色卡叫「朴智旻」「金泰亨」——只写名也认，只认得上一张才算
const test = require("node:test");
const assert = require("node:assert/strict");
const app = require("fs").readFileSync(require("path").join(__dirname, "..", "js", "app.js"), "utf8");
test("头像认人：一字不差优先，其次「姓＋名」唯一一张", () => {
  const i = app.indexOf("const _phoneFaceChar = (ownerId, name) => {");
  const src = app.slice(i, app.indexOf("window.__phoneFaceOf = ", i));
  const mk = new Function("characters", "netOf", src + "\nreturn _phoneFaceChar;");
  const cs = [{ id: "o" }, { id: "a", name: "朴智旻" }, { id: "b", name: "金泰亨" }, { id: "c", name: "柾国" }, { id: "d", name: "李明" }, { id: "e", name: "王明" }];
  const f = mk(cs, () => "");
  assert.equal(f("o", "智旻").id, "a");
  assert.equal(f("o", "泰亨").id, "b");
  assert.equal(f("o", "柾国").id, "c");
  assert.equal(f("o", "明"), null, "一个字不认");
  assert.equal(f("o", "祝珍"), null);
});
