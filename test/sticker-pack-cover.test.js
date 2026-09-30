const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const comp = fs.readFileSync(__dirname + "/../js/components.js", "utf8");
const scr = fs.readFileSync(__dirname + "/../js/screens.js", "utf8");
test("封面：挑过用挑的、挑的那张揭掉了退回第一张；底栏过 stickerSrc", () => {
  const src = comp.slice(comp.indexOf("function packCoverOf"), comp.indexOf("function StickerPanel"));
  const f = new Function(src + "; return packCoverOf;")();
  const a = { id: "a" }, b = { id: "b" };
  assert.strictEqual(f({ emotes: [a, b] }), a);
  assert.strictEqual(f({ emotes: [a, b], cover: "b" }), b);
  assert.strictEqual(f({ emotes: [a], cover: "b" }), a);
  assert.ok(comp.includes("src: stickerSrc((packCoverOf(pk) || {}).url)"));
  assert.ok(scr.includes("onUpdatePack(pack.id, { cover: selEmotes[0] })"));
});
