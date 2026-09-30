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
test("「挑几张」和「设成封面」包在 note 右边那一格里，不许把挑几张挤掉", () => {
  const i = scr.indexOf('note("这一版上贴着的"');
  const seg = scr.slice(i, scr.indexOf('"挑几张"', i) + 10);
  assert.ok(seg.includes('h("span", { className: "flex items-center shrink-0" }'));
});
