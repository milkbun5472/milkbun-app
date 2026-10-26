const test = require("node:test"), assert = require("node:assert"), fs = require("fs"), vm = require("vm");
const eng = fs.readFileSync("js/engine.js", "utf8"), app = fs.readFileSync("js/app.js", "utf8"), ui = fs.readFileSync("js/screens-ui.js", "utf8");
const src = eng.slice(eng.indexOf("function loreScopeOn("), eng.indexOf("function loreKeywordHit("));
const ctx = {}; vm.runInNewContext(src + ";this.f=loreScopeOn;", ctx);
test("聊天与线下可以只挑一半", () => {
  const f = ctx.f;
  assert.equal(f({}, "chat"), true); assert.equal(f({}, "offline"), true);
  assert.equal(f({ scope: { chat: true, side: "offline" } }, "chat"), false);
  assert.equal(f({ scope: { chat: true, side: "offline" } }, "offline"), true);
  assert.equal(f({ scope: { chat: true, side: "online" } }, "offline"), false);
  assert.equal(f({ scope: { chat: false } }, "offline"), false);
});
test("单人、群线下都走 offline 去向", () => {
  assert.match(app, /oCtx\.worldbook = loreText\(loreRef\.current, \{ charIds: \[charId\], scope: "offline"/);
  assert.match(app, /charIds: \(group\.memberIds \|\| \[\]\), scope: "offline", text: offText/);
  assert.match(ui, /data-lore-side/);
});
