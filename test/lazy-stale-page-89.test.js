// 旧标签页拿到新版代码（2026-11-21 群友：旧标签页点信息白屏，报 Identifier 'NOTIFY_ROW' has already been declared）
//   执行到一半炸过的那一组：不许再执行同一份，直接告诉她刷新。
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const src = fs.readFileSync(path.join(__dirname, "..", "js/lazy-mods.js"), "utf8");

function boot() {
  const tag = { attrs: { "data-lazy": "screens", "data-src": "js/screens-ui.js?v=1" }, getAttribute(k) { return this.attrs[k]; }, setAttribute(k, v) { this.attrs[k] = v; } };
  let runs = 0;
  const document = {
    querySelectorAll: () => [tag],
    createElement: () => ({}),
    head: { appendChild: () => { runs++; if (runs === 1) throw new Error("boom"); throw new SyntaxError("Identifier 'NOTIFY_ROW' has already been declared"); } },
    hidden: false,
  };
  const window = { addEventListener() {} };
  const g = {};
  const fetch = async () => ({ ok: true, text: async () => "const NOTIFY_ROW = 50;" });
  new Function("window", "document", "fetch", "globalThis", "navigator", src)(window, document, fetch, g, {});
  const L = window.LazyMods || g.LazyMods;
  return { L, runs: () => runs };
}

test("执行炸了：报要刷新，再点也不重跑", async () => {
  const { L, runs } = boot();
  assert.ok(L, "没挂出 LazyMods");
  await assert.rejects(L.load("screens"), e => e.needReload === true && /刷新/.test(e.message));
  await assert.rejects(L.load("screens"), e => e.needReload === true);
  assert.equal(runs(), 1, "同一份又执行了一遍");
});

test("LazyGate 认得要刷新的错，按钮换成刷新", () => {
  const comp = fs.readFileSync(path.join(__dirname, "..", "js/components.js"), "utf8");
  const i = comp.indexOf("function LazyGate("), body = comp.slice(i, comp.indexOf("\n}\n", i));
  assert.match(body, /needReload/);
  assert.match(body, /location\.reload\(\)/);
});
