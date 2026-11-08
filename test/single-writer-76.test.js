const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const eng = fs.readFileSync(__dirname + "/../js/engine.js", "utf8"), app = fs.readFileSync(__dirname + "/../js/app.js", "utf8"), cloud = fs.readFileSync(__dirname + "/../js/cloud.js", "utf8");
// 2026-11-08 排查「配角、通讯录的人不见了，聊天还在」：两份同时开着，旧的那份把更旧的名单整份写回去
test("最新打开的那一份说了算：别的窗口一打招呼，这一份停写", () => {
  assert.match(eng, /ch\.onmessage = e => \{ const m = e && e\.data; if \(m && m\.t === "qq-hello" && m\.id !== QQ_INSTANCE\) freeze\(\); \};/);
  assert.match(eng, /function txtWrite\(k, s\) \{\n  if \(typeof qqFrozen === "function" && qqFrozen\(\)\) return true;/);
  assert.match(eng, /function saveJSON\(k, v\) \{\n  if \(typeof qqFrozen === "function" && qqFrozen\(\)\) return true;/);
  assert.match(cloud, /async autoPush\(\) \{\n      if \(typeof window !== "undefined" && window\.__qqFrozen\) return;/);
});
test("开机迁头像只改图那两格，不把开头读到的名单整份写回去", () => {
  assert.doesNotMatch(app, /if \(chChanged\) \{ saveJSON\("x_characters", chars\); setCharacters\(chars\); \}/);
  assert.match(app, /if \(Object\.keys\(moved\)\.length\) pC\(p => p\.map\(c => c && moved\[c\.id\] \? \{ \.\.\.c, \.\.\.moved\[c\.id\] \} : c\)\);/);
});
test("两份之间真的会停写（BroadcastChannel 模拟）", () => {
  const src = eng.slice(eng.indexOf("const QQ_INSTANCE"), eng.indexOf("function charShrinkOk("));
  const chans = [];
  function BC() { this.onmessage = null; chans.push(this); }
  BC.prototype.postMessage = function (m) { chans.forEach(c => { if (c !== this && c.onmessage) c.onmessage({ data: m }); }); };
  const mk = () => { const w = { addEventListener() {} }; const doc = { body: null, addEventListener() {}, getElementById() { return null; } };
    new Function("window", "document", "BroadcastChannel", "localStorage", "location", src)(w, doc, BC, { setItem() {} }, {}); return w; };
  const a = mk(); assert.ok(!a.__qqFrozen);
  const b = mk(); assert.ok(a.__qqFrozen, "旧的那份该停写"); assert.ok(!b.__qqFrozen, "新的那份照常");
});
