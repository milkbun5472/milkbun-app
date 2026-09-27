// 组件收成 app 图标（她 2026-09-28「日历记账这些组件能不能变成 app 1x1 的样式和图标」）
const assert = require("node:assert/strict");
const src = require("fs").readFileSync(require("path").join(__dirname, "..", "js", "components.js"), "utf8");
assert.match(src, /\{ id: "icon", name: "图标", note: "1 × 1 · 像 app", cols: 1, rows: 1, glyph: "▢", widgetOnly: true \}/);
assert.match(src, /HOME_SIZE_PRESETS\.filter\(function \(p\) \{ return !p\.widgetOnly \|\| allowIcon; \}\)/, "装饰那边不给这一档");
assert.match(src, /h\(HomeSizeGrid, \{ value: A\.size \|\| "auto", onChange: A\.setSize, allowIcon: !!A\.isWidget \}\)/);
assert.match(src, /const asIcon = it\.kind === "widget" && homeSize === "icon";/);
assert.match(src, /var look = asIcon \? null :/, "收成图标时不套组件外观层");
assert.match(src, /overflow: \(it\.kind === "decor" \|\| tiltDeg \|\| asIcon\) \? "visible"/, "图标下面那行字不许被裁");
// 去哪儿跟组件自己点开去的是同一处
for (const [w, open] of [["cal", "calendar"], ["ledger", "ledger"], ["us", "us"], ["music", "listen"], ["card", "codex"]])
  assert.match(src, new RegExp("  " + w + ": \\{ G: [\\s\\S]{0,260}?open: \"" + open + "\" \\}"));
console.log("widget as icon ok");
