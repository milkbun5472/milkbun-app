const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const app = fs.readFileSync(path.join(__dirname, "..", "js", "app.js"), "utf8");
const screens = fs.readFileSync(path.join(__dirname, "..", "js", "screens.js"), "utf8");
const index = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");

test("optional assistive model switch persists online and offline routes separately", () => {
  assert.match(app, /function ModelQuickSwitch\(/);
  assert.match(app, /x_modelFloatOn/);
  assert.match(app, /saveJSON\("x_activeApi", id\)/);
  assert.match(app, /saveJSON\("x_offlineApi", id\)/);
  assert.match(app, /角色专线仍由 apiFor\/offlineApiFor 优先/);
  assert.match(screens, /模型快速切换浮窗/);
  assert.match(screens, /角色专线不受影响/);
  assert.match(index, /js\/screens\.js\?v=[\d.]+/); // 改动指纹由 app-cache-version 统一校验
});

// 群友 2026-09-30：「这个 api 的快捷悬浮按钮是不是可以做成不用时吸附到边边就显示半个比较好，它有点点占屏」
test("闲着 3 秒就贴边藏一半；开着、拖着、按下去时整颗露出来", () => {
  const src = require("node:fs").readFileSync(require("node:path").join(__dirname, "..", "js", "app.js"), "utf8");
  const i = src.indexOf("function ModelQuickSwitch("), j = src.indexOf("\nfunction ", i + 10);
  assert.ok(i > 0 && j > i, "抠不出 ModelQuickSwitch");
  const f = src.slice(i, j);
  assert.match(f, /const TUCK_MS = 3000;/);
  assert.match(f, /if \(open \|\| drag\) \{ setIdle\(false\); return; \}/, "开着或拖着的时候还会缩进去");
  assert.match(f, /const tucked = idle && !open && !drag;/);
  assert.match(f, /const onDown = e => \{\n\s*setIdle\(false\);/, "按下去没先整颗露出来");
  assert.match(f, /side === "left" \? \{ left: tucked \? -23 : 12, flexDirection: "row-reverse" \} : \{ right: tucked \? -23 : 12 \}/, "没往边上缩一半（按钮 46 宽，缩 23）");
});
