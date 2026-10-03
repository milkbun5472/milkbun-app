// 群友 2026-10-03：「人格档案馆里面的角色可不可以调换顺序，我想把最重要的几个放在上面方便修改」
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const P = f => fs.readFileSync(path.join(__dirname, "..", f), "utf8");
const app = P("js/app.js"), screens = P("js/screens.js");

const moveFn = () => {
  const i = app.indexOf("    onMove: (id, dir) => pC(p => {");
  assert.ok(i > 0, "档案馆没接 onMove");
  const body = app.slice(app.indexOf("{", app.indexOf("pC(p =>", i)), app.indexOf("\n    }),", i) + 6);
  return new Function("p", "id", "dir", body.replace(/^\{/, "").replace(/\}\s*$/, ""));
};

test("置顶 / 上移 / 下移，配角夹在中间时跳过它", () => {
  const f = moveFn();
  const L = [{ id: "a" }, { id: "n", npc: true }, { id: "b" }, { id: "c" }];
  assert.deepEqual(f(L, "c", "top").map(x => x.id), ["c", "a", "n", "b"]);
  assert.deepEqual(f(L, "b", -1).map(x => x.id), ["b", "n", "a", "c"]);
  assert.deepEqual(f(L, "a", 1).map(x => x.id), ["b", "n", "a", "c"]);
  assert.equal(f(L, "a", -1), L, "第一个再上移不动");
});

test("档案馆顶栏有排序开关", () => {
  assert.match(screens, /sorting \? "完成" : "排序"/);
  assert.match(screens, /btn\("置顶", "top", i === 0\)/);
});
