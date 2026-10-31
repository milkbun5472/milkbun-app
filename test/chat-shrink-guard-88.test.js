// 聊天一下子变短就留一份（她 2026-10-31：群友线上聊天中间一大段没了，原因对不上）
"use strict";
const test = require("node:test"), assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path"), vm = require("node:vm");
const R = f => fs.readFileSync(path.join(__dirname, "..", "js", f), "utf8");
const eng = R("engine.js"), app = R("app.js"), comp = R("components.js");
test("所有写聊天的路都过 txtWrite：变短 10 条以上留一份、记一笔", () => {
  const fnSrc = eng.slice(eng.indexOf("const SHRINK_MIN = 10;"), eng.indexOf("function txtWrite(k, s) {"));
  const writes = {}, mirror = new Map();
  const ctx = { console: { warn() {} }, _txtMirror: () => mirror, txtWrite: (k, v) => { writes[k] = v; mirror.set(k, v); }, JSON, Date, Error, String };
  vm.createContext(ctx); vm.runInContext(fnSrc + "\nglobalThis.note = noteChatShrink;", ctx);
  const msgs = n => JSON.stringify(Array.from({ length: n }, (_, i) => ({ role: "user", content: "x" + i, ts: i })));
  ctx.note("x_chat:a", msgs(30), msgs(25));
  assert.equal(writes["x_shrinkBak:x_chat:a"], undefined, "少几条是正常删改，不留");
  ctx.note("x_chat:a", msgs(30), msgs(12));
  const bak = JSON.parse(writes["x_shrinkBak:x_chat:a"]);
  assert.equal(bak.from, 30); assert.equal(bak.to, 12); assert.equal(JSON.parse(bak.data).length, 30);
  assert.equal(JSON.parse(writes.x_shrinkLog).length, 1);
  assert.match(eng, /if \(\/\^x_g\?chat:\/\.test\(k\)\) \{ const prev = _txtMirror\(\)\.get\(k\); if \(prev != null && s\.length < prev\.length\) noteChatShrink/);
});
test("合并回来：只插回少掉的，现有的不动；设置里有备份才出现", () => {
  assert.match(app, /const back = old\.filter\(m => m && !have\.has\(sig\(m\)\)\)/);
  assert.match(comp, /shrinkBak && h\("div", \{ className: "pt-6", "data-wk": "csshrink" \}/);
});
