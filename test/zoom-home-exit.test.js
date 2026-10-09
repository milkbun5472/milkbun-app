// 主屏不跟着放大（群友 2026-10-09：拉了「全 App 多大」，设置被挤出屏幕点不到）
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const T = fs.readFileSync(path.join(__dirname, "../js/theme-studio.js"), "utf8");

test("「全 App」那条跳过主屏；单给主屏的那条不收", () => {
  assert.match(T, /page === "all" \? 'html:not\(\[data-lisa-screen="home"\]\) body'/);
  const fn = T.slice(T.indexOf("const cleanZoom = obj =>"), T.indexOf("const zoomFor = "));
  assert.match(fn, /if \(key === "home"\) return;/);
});
