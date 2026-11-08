const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const eng = fs.readFileSync(__dirname + "/../js/engine.js", "utf8"), app = fs.readFileSync(__dirname + "/../js/app.js", "utf8"), c = fs.readFileSync(__dirname + "/../js/components.js", "utf8");
// 群里 2026-11-08：「配角不见了，通讯录里的人也不见了，我啥都没碰，正常聊天」——聊天记录还在
test("角色名单被写少、又不是她删的：少掉的人留备份，记下是哪段代码写的", () => {
  assert.match(eng, /if \(k === "x_characters"\) \{ const prev = _txtMirror\(\)\.get\(k\); if \(prev != null && prev !== s\) noteCharShrink\(String\(prev\), s\); \}/);
  assert.match(eng, /idbTxtPut\("x_shrinkBak:x_characters"/);
  assert.match(eng, /function charShrinkOk\(ms\)/);
});
test("她亲手删的（删卷宗、删配角、危险确认）不算", () => {
  assert.match(app, /charShrinkOk\(\);   \/\/ 她亲手删的：不当成「不见了」/);
  assert.match(app, /charShrinkOk\(\);   \/\/ 她亲手删的配角/);
  assert.match(c, /if \(typeof charShrinkOk === "function"\) charShrinkOk\(30000\);/);
});
test("通讯录顶上「不见的人」，一键放回来", () => {
  assert.match(c, /lostN \? entry\("不见的人"/);
  assert.match(app, /window\.__charLostRestore = async \(\) =>/);
});
test("noteCharShrink 只认少掉的 id", () => {
  const src = eng.slice(eng.indexOf("function charShrinkOk("), eng.indexOf("function txtWrite(k, s) {"));
  const puts = [], logs = [];
  const win = {};
  const f = new Function("window", "_txtMirror", "txtWrite", "idbTxtGet", "idbTxtPut", src + "; return noteCharShrink;")(
    win, () => ({ get: () => "[]" }), (k, v) => logs.push(v), () => Promise.resolve(null), (k, v) => { puts.push(JSON.parse(v)); return Promise.resolve(); });
  f(JSON.stringify([{ id: "a" }, { id: "b", npc: true }]), JSON.stringify([{ id: "a" }]));
  return new Promise(r => setTimeout(r, 10)).then(() => {
    assert.equal(puts.length, 1);
    assert.deepEqual(puts[0].lost.map(x => x.id), ["b"]);
  });
});
