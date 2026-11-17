// 主屏实心图标（她 2026-11-17）：底栏四个画实心版，铺满格子；她换过的图标不走这里
const test = require("node:test"), assert = require("node:assert");
const fs = require("fs"), path = require("path");
const core = fs.readFileSync(path.join(__dirname, "..", "js", "core.js"), "utf8");
const comp = fs.readFileSync(path.join(__dirname, "..", "js", "components.js"), "utf8");
test("底栏四个都在 FILLED_ICONS 里", () => {
  const m = core.match(/const FILLED_ICONS = (\{[\s\S]*?\});\n/);
  assert.ok(m);
  const map = JSON.parse(m[1]);
  for (const k of ["messages", "forum", "diary", "config"]) assert.ok(map[k], k);
});
test("GlassIcon 先看自定义图，再看实心图，最后才是线条", () => {
  const i = comp.indexOf("function GlassIcon");
  const body = comp.slice(i, comp.indexOf("\n}\n", i));
  assert.match(body, /const filled = !customSrc && tone && typeof filledIconSvg === "function"/);
  assert.match(body, /"data-wk": "iconfill"/);
});
