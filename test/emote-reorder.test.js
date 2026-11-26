const test = require("node:test"); const assert = require("node:assert/strict"); const fs = require("fs");
const app = fs.readFileSync(__dirname + "/../js/app.js", "utf8"), ui = fs.readFileSync(__dirname + "/../js/screens-ui.js", "utf8");
const comp = fs.readFileSync(__dirname + "/../js/components.js", "utf8");
const cut = (src, a, b) => { const i = src.indexOf(a), j = src.indexOf(b, i); assert.ok(i > 0 && j > i, "抠不出 " + a); return src.slice(i, j); };
const idsReorder = new Function(cut(comp, "function idsReorder(", "function StickerPanel(") + "; return idsReorder;")();
const packs = () => [{ id: "a", emotes: [{ id: 1, url: "u1" }, { id: 2, url: "u2" }, { id: 3, url: "u3" }] }, { id: "b", global: true, emotes: [{ id: 4, url: "u4" }] }, { id: "c", charIds: ["x"], emotes: [{ id: 5, url: "u5" }] }];
const wire = () => {
  const ref = { current: packs() }, saves = [];
  const commit = n => { saves.push(n); ref.current = n; return true; };
  const body = cut(app, "const reorderEmotePacks = ", "const deleteEmotes");
  const fns = new Function("emotePacksRef", "commitEmotePacks", "idsReorder", body + "; return { reorderEmotePacks, reorderEmotes };")(ref, commit, idsReorder);
  return { ref, saves, fns };
};
test("整套能往前、往后、挪到最前，走 commitEmotePacks 存", () => {
  const { ref, saves, fns } = wire();
  fns.reorderEmotePacks("c", "first"); assert.deepEqual(ref.current.map(p => p.id), ["c", "a", "b"]);
  fns.reorderEmotePacks("a", 1); assert.deepEqual(ref.current.map(p => p.id), ["c", "b", "a"]);
  fns.reorderEmotePacks("b", -1); assert.deepEqual(ref.current.map(p => p.id), ["b", "c", "a"]);
  fns.reorderEmotePacks("b", -1); assert.deepEqual(ref.current.map(p => p.id), ["b", "c", "a"]);
  assert.equal(saves.length, 4);
});
test("一套里的张能挪，挑几张挪到最前保持原先后", () => {
  const { ref, fns } = wire();
  fns.reorderEmotes("a", [3], -1); assert.deepEqual(ref.current[0].emotes.map(e => e.id), [1, 3, 2]);
  fns.reorderEmotes("a", [2, 3], "first"); assert.deepEqual(ref.current[0].emotes.map(e => e.id), [3, 2, 1]);
  assert.deepEqual(ref.current[1].emotes.map(e => e.id), [4]);
});
test("发表情那一格照存的先后摆（单聊和群聊）", () => {
  const { ref, fns } = wire();
  fns.reorderEmotePacks("c", "first");
  const body = cut(app, "const emotePacksForChar = ", "const genCarrySection");
  const f = new Function("emotePacksRef", "maskKeyOf", body + "; return { emotePacksForChar, emotePacksForGroup };")(ref, () => "");
  assert.deepEqual(f.emotePacksForChar("x").map(p => p.id), ["c", "a", "b"]);
  assert.deepEqual(f.emotePacksForGroup(["y", "x"]).map(p => p.id), ["c", "a", "b"]);
  const panel = cut(comp, "function StickerPanel(", "\n}\n");
  assert.doesNotMatch(panel, /\.sort\(/);
});
test("入口：长按一版／一张弹排顺序菜单，挑几张能挪到最前；挂点登记了", () => {
  assert.match(app, /onReorderPack: reorderEmotePacks/); assert.match(app, /onReorderEmotes: reorderEmotes/);
  assert.match(ui, /pressOn\(\{ kind: "pack"/); assert.match(ui, /pressOn\(\{ kind: "emote"/);
  assert.match(ui, /onReorderEmotes\(pack\.id, selEmotes, "first"\)/);
  const ts = fs.readFileSync(__dirname + "/../js/theme-studio.js", "utf8");
  ["emoordermenu", "emoordermenuitem", "emoselfirst"].forEach(k => assert.match(ts, new RegExp('"' + k + '"')));
});
