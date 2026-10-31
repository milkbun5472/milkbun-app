// 购物、外卖挑人也能挑配角（2026-10-31）：主要角色在前，配角在后，收起来的不列
const test = require("node:test"), assert = require("node:assert");
const fs = require("fs"), path = require("path");
const app = fs.readFileSync(path.join(__dirname, "..", "js", "app.js"), "utf8");
test("shopPeople = 主要角色 + 没收起来的配角", () => {
  assert.match(app, /const shopPeople = liveChars\.concat\(characters\.filter\(c => c && c\.npc && !c\.shelved\)\)/);
});
test("购物和外卖都用 shopPeople", () => {
  for (const scr of ['screen === "shop") body = h(Shop, {', 'screen === "takeout") body = h(Takeout, {']) {
    const a = app.indexOf(scr); assert.ok(a > 0);
    assert.match(app.slice(a, a + 2000), /characters: shopPeople,/);
  }
});
