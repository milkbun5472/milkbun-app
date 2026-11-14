// 开机卡上的按钮要点得动（她 2026-11-14：好多人说点不了「重新加载」）
// 「还在下载」那张每 6 秒刷一次秒数；原来整张拆了重建，按下去的按钮松手前就换了一颗。
const test = require("node:test"), assert = require("node:assert/strict");
const html = require("fs").readFileSync(require("path").join(__dirname, "..", "index.html"), "utf8");
const card = html.slice(html.indexOf("function card(title, body)"), html.indexOf("function show()"));
test("卡已经在了就只换字，不拆按钮", () => {
  assert.match(card, /prev\.querySelector\("\[data-bg-t\]"\)\.innerHTML = title/);
  assert.match(card, /return; \}\s*\n?\s*if \(prev\) prev\.remove\(\)/);
  assert.match(card, /data-bg-t="1"/); assert.match(card, /data-bg-b="1"/);
});
test("两颗按钮按下去就算", () => {
  assert.match(card, /addEventListener\("pointerup", go\)/);
  assert.match(card, /tap\(document\.getElementById\("__bg_r"\)/);
  assert.match(card, /tap\(document\.getElementById\("__bg_h"\), nuke\)/);
});
test("「重新加载」是真链接，脚本被卡住时浏览器也会自己跳", () => {
  assert.match(card, /<a id="__bg_r" href="\.\/"/);
});
