const test = require("node:test"); const assert = require("node:assert"); const fs = require("fs");
const src = fs.readFileSync(__dirname + "/../js/nest.js", "utf8");
const a = src.indexOf("const FOLD_KEEP"), b = src.indexOf("const FoldSlip");
const foldRuns = new Function(src.slice(a, b) + "; return foldRuns;")();
const mk = (uid, n, p) => Array.from({ length: n }, (_, i) => ({ id: p + i, uid, nick: uid, badge: uid === "A" ? "管理员" : "" }));
test("管理员连着一大串：留前三张，后面收成一张", () => {
  const out = foldRuns(mk("A", 10, "a").concat(mk("B", 2, "b")));
  assert.deepStrictEqual(out.map(x => x.fold ? "F" + x.n : x.id), ["a0", "a1", "a2", "F7", "b0", "b1"]);
});
test("普通人（没牌子）连着十张也不折", () => {
  assert.strictEqual(foldRuns(mk("B", 10, "b")).length, 10);
});
test("连着四张不折（折了只省一张）；没 uid 的不折", () => {
  assert.strictEqual(foldRuns(mk("A", 4, "a")).length, 4);
  assert.strictEqual(foldRuns(mk("", 9, "x")).length, 9);
});
test("只首页墙折，搜索时不折", () => {
  assert.ok(src.includes("fold: !qLive"));
});
