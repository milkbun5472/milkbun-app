const test = require("node:test"); const assert = require("node:assert");
const src = require("fs").readFileSync(__dirname + "/../js/app.js", "utf8");
const a = src.indexOf("const maskStrangersOf ="), b = src.indexOf("const ctxFor = (char, ctxOpts)");
test("别的面具的人名不从 ctx 漏进去", () => {
  const body = src.slice(a, b);
  const fn = new Function("characters", "rels", "groups", "maskKeyOf", "copyMemoryRecallMeta",
    body + "; return maskScrub;");
  const chars = [{ id: "a", name: "阿白" }, { id: "x", name: "小黑" }, { id: "y", name: "同屋" }];
  const scrub = fn(chars, {}, [], id => id === "x" ? "m2" : "", (f, t) => t);
  const ctx = scrub({ financeNote: "奶茶；给小黑买礼物；电影票", memoNote: "小黑生日\n交房租", memLib: [{ text: "她和小黑看电影" }, { text: "她和同屋吃饭" }] }, chars[0]);
  assert.equal(ctx.financeNote, "奶茶；电影票");
  assert.equal(ctx.memoNote, "交房租");
  assert.deepEqual(ctx.memLib.map(m => m.text), ["她和同屋吃饭"]);
  // 关系网里连着线的不算外人
  const scrub2 = fn(chars, { "a->x": { label: "朋友" } }, [], id => id === "x" ? "m2" : "", (f, t) => t);
  assert.match(scrub2({ memoNote: "小黑生日" }, chars[0]).memoNote, /小黑/);
  assert.match(src.slice(b, b + 120), /maskScrub\(ctxForRaw\(char, ctxOpts\), char\)/);
});
